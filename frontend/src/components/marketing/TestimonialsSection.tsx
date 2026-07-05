"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "I was getting 200+ leads from 99acres and JustDial every month. My telecaller could barely handle 40. LeadBridge calls every single one within a minute. My bookings went from 8 to 24 a month.",
    name: "Rajesh Mehta",
    role: "Broker, Andheri West",
    result: "3x more bookings",
    avatar: "RM",
    rating: 5,
  },
  {
    quote: "The AI speaks Hinglish so naturally that leads don't even realize it's an AI. They happily share their budget, timeline, everything. And the WhatsApp summary after each call is a lifesaver.",
    name: "Priya Sharma",
    role: "Broker, Baner, Pune",
    result: "94% call answer rate",
    avatar: "PS",
    rating: 5,
  },
  {
    quote: "I was skeptical about AI calling at first. But the 3-day follow-up sequence recovered leads I had written off. One cold lead from 2 months ago rebooked after the D3 call. ₹1.2Cr deal.",
    name: "Amit Verma",
    role: "Broker, Wakad, Pune",
    result: "₹1.2Cr deal recovered",
    avatar: "AV",
    rating: 5,
  },
  {
    quote: "The territory exclusivity is a game-changer. I know no other broker in Thane West can use LeadBridge. It's my city, my leads, my AI agent. The competition is stuck with manual calling.",
    name: "Sneha Patel",
    role: "Broker, Thane West",
    result: "Exclusive territory locked",
    avatar: "SP",
    rating: 5,
  },
  {
    quote: "Setup took 10 minutes. Connected my 99acres account, configured my territory, and the AI started calling immediately. The first booking came through within 2 hours. I've never seen anything like this.",
    name: "Vikram Singh",
    role: "Broker, Indore",
    result: "First booking in 2 hours",
    avatar: "VS",
    rating: 5,
  },
  {
    quote: "We have a team of 5 agents. LeadBridge handles all qualification calls automatically and only notifies us when a visit is booked. Our team now spends 100% of their time closing instead of cold calling.",
    name: "Arjun Nair",
    role: "Team Lead, Kochi",
    result: "5-agent team, 100% closing time",
    avatar: "AN",
    rating: 5,
  },
];

export default function TestimonialsSection() {
  const [active, setActive] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % testimonials.length);
  }, []);

  const prev = useCallback(() => {
    setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, next]);

  return (
    <section className="relative py-20 lg:py-32 bg-[#0A0A0F]" id="testimonials">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#C9A84C] mb-4 block">BROKERS LOVE US</span>
          <h2 className="h1-text mb-4">Real results from real brokers</h2>
          <p className="text-[16px] text-[#6B6B8A] max-w-[500px] mx-auto">
            From Mumbai to Kochi, brokers are converting more leads with less effort.
          </p>
        </div>

        {/* Main Testimonial Card */}
        <div className="relative max-w-3xl mx-auto">
          <div className="relative p-8 md:p-10 rounded-2xl bg-gradient-to-br from-[#111118] to-[#1A1A24] border border-[#2A2A3A]">
            {/* Quote icon */}
            <Quote className="absolute top-6 left-6 w-8 h-8 text-[#4F6EF7]/20" />

            {/* Rating */}
            <div className="flex items-center gap-1 mb-6">
              {Array.from({ length: testimonials[active].rating }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#C9A84C] text-[#C9A84C]" />
              ))}
            </div>

            {/* Quote */}
            <p className="text-[16px] md:text-[18px] text-[#F0F0F8] leading-relaxed mb-8">
              &ldquo;{testimonials[active].quote}&rdquo;
            </p>

            {/* Author */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4F6EF7] to-[#4F6EF7]/60 flex items-center justify-center text-white text-[16px] font-semibold">
                  {testimonials[active].avatar}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#F0F0F8]">{testimonials[active].name}</p>
                  <p className="text-[13px] text-[#6B6B8A]">{testimonials[active].role}</p>
                </div>
              </div>
              <div className="hidden sm:block px-4 py-2 rounded-full bg-[#22D3A5]/10 border border-[#22D3A5]/20">
                <span className="text-[13px] font-semibold text-[#22D3A5]">{testimonials[active].result}</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => { prev(); setIsAutoPlaying(false); }}
              className="p-2 rounded-full border border-[#2A2A3A] hover:bg-[#1A1A24] text-[#6B6B8A] hover:text-[#F0F0F8] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setActive(i); setIsAutoPlaying(false); }}
                  className={`transition-all duration-300 rounded-full ${
                    i === active ? "w-8 h-2 bg-[#4F6EF7]" : "w-2 h-2 bg-[#2A2A3A] hover:bg-[#3A3A52]"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => { next(); setIsAutoPlaying(false); }}
              className="p-2 rounded-full border border-[#2A2A3A] hover:bg-[#1A1A24] text-[#6B6B8A] hover:text-[#F0F0F8] transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-play indicator */}
          {isAutoPlaying && (
            <div className="flex justify-center mt-4">
              <span className="text-[11px] text-[#3A3A52]">Auto-rotating testimonials</span>
            </div>
          )}
        </div>

        {/* Bottom Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
          {[
            { value: "150+", label: "Active Brokers" },
            { value: "50K+", label: "Calls Made" },
            { value: "12K+", label: "Visits Booked" },
            { value: "94%", label: "Call Answer Rate" },
          ].map((stat, i) => (
            <div key={i} className="text-center p-4 rounded-lg bg-[#111118] border border-[#2A2A3A]">
              <p className="text-[24px] font-display font-bold text-[#F0F0F8]">{stat.value}</p>
              <p className="text-[12px] text-[#6B6B8A] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
