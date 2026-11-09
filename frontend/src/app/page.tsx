import HeroSection from "@/components/marketing/HeroSection";
import MarqueeTicker from "@/components/marketing/MarqueeTicker";
import FeatureShowcase from "@/components/marketing/FeatureShowcase";
import ComparisonSection from "@/components/marketing/ComparisonSection";
import PricingSection from "@/components/marketing/PricingSection";
import IntegrationSection from "@/components/marketing/IntegrationSection";
import FAQSection from "@/components/marketing/FAQSection";
import ResultsSection from "@/components/marketing/ResultsSection";
import ROISection from "@/components/marketing/ROISection";
import HowItWorksSection from "@/components/marketing/HowItWorksSection";
import LegalStubs from "@/components/marketing/LegalStubs";
import CTASection from "@/components/marketing/CTASection";

export default function Home() {
  return (
    <>
      <MarqueeTicker />

      {/* Hero */}
      <HeroSection />

      {/* Feature Showcase */}
      <FeatureShowcase />

      {/* Comparison */}
      <ComparisonSection />

      {/* Pricing */}
      <PricingSection />

      {/* Integrations */}
      <IntegrationSection />

      {/* FAQ */}
      <FAQSection />

      {/* Results */}
      <ResultsSection />

      {/* ROI */}
      <ROISection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Legal */}
      <LegalStubs />

      {/* Final CTA */}
      <CTASection />
    </>
  );
}
