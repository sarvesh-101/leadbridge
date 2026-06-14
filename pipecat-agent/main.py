"""
LeadBridge Pipecat Agent — AI Voice Agent Service.

This FastAPI server receives Exotel call connections and runs the full
AI pipeline: Deepgram STT → DeepSeek LLM → Cartesia TTS.

Architecture:
1. Exotel connects an incoming call to this server
2. Pipecat framework manages the real-time audio stream
3. Deepgram transcribes the caller's speech (Hindi/Hinglish/English)
4. DeepSeek generates intelligent responses using the call script
5. Cartesia speaks the responses back to the caller

The agent outputs structured JSON at the end of each call for
post-call analysis by the EXTRACTION worker.
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import os

from config import config

app = FastAPI(
    title="LeadBridge Pipecat Agent",
    description="AI Voice Agent powered by DeepSeek + Deepgram + Cartesia",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ──────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    leadId: str
    clientId: str
    callType: str  # QUALIFICATION | BOOKING_REMINDER | FOLLOWUP_D1 | FOLLOWUP_D3
    exotelCallSid: str
    toNumber: str
    fromNumber: str
    clientConfig: Dict[str, Any]
    leadInfo: Dict[str, Any]


class StartSessionResponse(BaseModel):
    sessionId: str
    status: str


# ─── Auth Middleware ─────────────────────────────────────────────

async def verify_internal_auth(authorization: str = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = authorization.split(" ")[1]
    if token != config.pipecat_secret:
        raise HTTPException(status_code=401, detail="Invalid authorization")


# ─── Routes ──────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "pipecat-agent",
        "deepseek": bool(config.deepseek_api_key),
        "deepgram": bool(config.deepgram_api_key),
        "cartesia": bool(config.cartesia_api_key),
    }


@app.post("/session/start", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest):
    """
    Start a new Pipecat AI call session.
    
    In production, this creates a Pipecat pipeline that:
    1. Connects to the Exotel audio stream
    2. Runs Deepgram STT on incoming audio
    3. Processes text through DeepSeek V3
    4. Generates TTS via Cartesia
    5. Streams audio back to Exotel
    
    For Phase 1, we return a session ID and the Pipecat pipeline
    will be implemented when the Pipecat SDK is fully available.
    """
    import uuid
    session_id = str(uuid.uuid4())

    # Build the system prompt for DeepSeek based on call type and client config
    system_prompt = _build_system_prompt(request)

    # Store session in memory (use Redis in production)
    app.state.active_sessions = getattr(app.state, "active_sessions", {})
    app.state.active_sessions[session_id] = {
        "lead_id": request.leadId,
        "client_id": request.clientId,
        "call_type": request.callType,
        "exotel_call_sid": request.exotelCallSid,
        "system_prompt": system_prompt,
        "status": "connecting",
        "transcript": [],
        "started_at": None,
    }

    return StartSessionResponse(
        sessionId=session_id,
        status="connecting",
    )


@app.post("/session/{session_id}/end")
async def end_session(session_id: str):
    """End an active Pipecat session."""
    sessions = getattr(app.state, "active_sessions", {})
    if session_id in sessions:
        sessions[session_id]["status"] = "ended"
        return {"status": "ended", "session_id": session_id}
    raise HTTPException(status_code=404, detail="Session not found")


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session status and transcript data."""
    sessions = getattr(app.state, "active_sessions", {})
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "status": session["status"],
        "call_type": session["call_type"],
        "transcript": session["transcript"][-50:],  # Last 50 exchanges
        "transcript_available": len(session["transcript"]) > 0,
    }


@app.post("/transcript")
async def receive_transcript(data: dict):
    """
    Receive transcript from Pipecat after a call ends.
    Called by the Pipecat pipeline after session completion.
    """
    session_id = data.get("session_id")
    transcript = data.get("transcript", "")
    extracted_data = data.get("extracted_data", {})

    if session_id:
        sessions = getattr(app.state, "active_sessions", {})
        if session_id in sessions:
            sessions[session_id]["status"] = "completed"
            sessions[session_id]["final_transcript"] = transcript
            sessions[session_id]["extracted_data"] = extracted_data

    return {"status": "received"}


# ─── Helper Functions ────────────────────────────────────────────

def _build_system_prompt(request: StartSessionRequest) -> str:
    """Build the DeepSeek system prompt for the call script."""
    client_config = request.clientConfig
    lead_info = request.leadInfo
    call_type = request.callType

    base_prompt = f"""You are a professional real estate lead qualification assistant calling on behalf of {client_config.get("businessName", "the business")} in India.

ROLE: You handle the initial outreach call for new property enquiries. Your ONLY goals are:
1. Qualify the lead (understand their need)
2. Answer basic FAQs about the property
3. Book a site visit if they are interested

MANDATORY RULES:
- Always disclose you are an AI assistant at the start of the call
- Speak in Hinglish (mix Hindi and English naturally — the way educated Indians speak)
- If they prefer pure Hindi or pure English, switch immediately
- Keep the call under 3 minutes
- Do NOT hard-sell. Be warm, professional, helpful.
- If they say not interested → thank them politely and end the call
- NEVER make up property details not in the knowledge base below"""

    # Call type specific instructions
    if call_type == "QUALIFICATION":
        base_prompt += f"""

CALL SCRIPT FLOW:
1. Open: "Hello, kya main {lead_info.get("name", "customer")} ji se baat kar sakta hoon?"
2. Introduce: "Ji, main {client_config.get("businessName", "our company")} ki taraf se ek AI assistant hoon"
3. Qualify: Ask about budget, location, timeline, bedrooms (4 questions naturally)
4. FAQ: Answer any questions using knowledge base
5. Book: Offer to arrange a site visit
6. Confirm: Repeat booking details
7. Close: Confirm WhatsApp confirmation will be sent"""
    elif call_type == "BOOKING_REMINDER":
        base_prompt += """

CALL SCRIPT FLOW:
1. Open: Confirm identity
2. Reminder: "Aapki aaj property visit hai"
3. Confirm: Ask if they're still coming
4. Rebook: If can't make it, offer reschedule
5. Close: Quick, under 1 minute"""
    elif call_type == "FOLLOWUP_D1":
        base_prompt += """

CALL SCRIPT FLOW:
1. Open: "Sorry you missed the visit"
2. Check: Are they still interested?
3. Rebook: Offer new date/time
4. Close: Confirm and send WhatsApp"""
    elif call_type == "FOLLOWUP_D3":
        base_prompt += """

CALL SCRIPT FLOW:
1. Open: Final check-in
2. Offer: Alternative properties if available
3. Last chance: Book now or we'll close the lead
4. Close: Polite ending regardless of outcome"""

    base_prompt += """

AFTER THE CALL — output this JSON as your final message (no markdown, raw JSON only):
"""
    base_prompt += '''{
  "qualified": boolean,
  "budget": "under-50L|50L-1Cr|1Cr-2Cr|above-2Cr|not-specified",
  "location": "area they mentioned or null",
  "timeline": "immediate|1-3months|3-6months|browsing|not-specified",
  "propertyType": "flat|villa|plot|commercial|rental|not-specified",
  "bedrooms": "1BHK|2BHK|3BHK|4BHK+|any|not-specified",
  "bookingRequested": boolean,
  "bookingDate": "YYYY-MM-DD or null",
  "bookingTime": "HH:MM AM/PM or null",
  "faqsAsked": ["list of questions they asked"],
  "sentiment": "positive|neutral|negative",
  "language": "hindi|english|hinglish",
  "summary": "2-3 sentence summary in English"
}'''

    return base_prompt


# ─── Main ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.host,
        port=config.port,
        reload=True,
    )
