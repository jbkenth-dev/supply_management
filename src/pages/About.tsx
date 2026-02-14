import { motion } from "framer-motion";
import { 
  Target, 
  Lightbulb, 
  ShieldCheck, 
  Zap, 
  Users, 
  Globe,
  ArrowRight
} from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "../components/ui/animations";
import { Button } from "../components/ui/Button";

export default function About() {
  const stats = [
    { label: "Active Users", value: "500+", icon: Users },
    { label: "Inventory Items", value: "10k+", icon: Zap },
    { label: "Global Reach", value: "24/7", icon: Globe },
    { label: "Security", value: "100%", icon: ShieldCheck },
  ];

  const features = [
    {
      title: "Streamlined Management",
      description: "Our core objective is to simplify complex supply chain workflows through intuitive digital tools.",
      icon: Target,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Real-time Insights",
      description: "Make data-driven decisions with our advanced analytics and real-time stock monitoring systems.",
      icon: Lightbulb,
      color: "bg-amber-50 text-amber-600"
    },
    {
      title: "Secure Operations",
      description: "Your data security is our priority, with enterprise-grade encryption and access controls.",
      icon: ShieldCheck,
      color: "bg-emerald-50 text-emerald-600"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 pt-24 pb-20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 mb-20">
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <span className="px-4 py-2 bg-primary-50 text-primary-600 text-xs font-black uppercase tracking-widest rounded-full mb-6 inline-block">
              Our Vision
            </span>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-8 tracking-tight leading-tight">
              Modernizing Supply Chain <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">
                For the Digital Era
              </span>
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed mb-10">
              SFC-G Supply Management is a comprehensive solution designed to streamline 
              and optimize your inventory operations through cutting-edge technology 
              and user-centric design.
            </p>
          </FadeIn>
        </div>

        {/* Stats Grid */}
        <StaggerContainer>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <StaggerItem key={index}>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center group hover:border-primary-200 transition-all">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-all">
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 mb-1">{stat.value}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                </div>
              </StaggerItem>
            ))}
          </div>
        </StaggerContainer>
      </section>

      {/* Content Sections */}
      <section className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
          <FadeIn direction="left">
            <div className="space-y-8">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                Our Mission & Objectives
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                We empower businesses with the tools they need to succeed in a competitive market 
                by providing a modern, efficient, and transparent solution for supply chain management.
              </p>
              
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-6 p-6 bg-white rounded-3xl border border-slate-100 hover:border-primary-100 transition-all shadow-sm">
                    <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${feature.color}`}>
                      <feature.icon className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn direction="right" delay={0.2}>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary-500/10 to-secondary-500/10 rounded-[3rem] blur-3xl" />
              <div className="relative bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl space-y-8">
                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-slate-900">Get in touch</h3>
                  <p className="text-slate-500">
                    Have questions about our system or need custom solutions for your enterprise?
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email Support</p>
                    <p className="text-slate-900 font-bold">support@sfcg-supply.com</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Office Location</p>
                    <p className="text-slate-900 font-bold">Tech District, Building 42</p>
                  </div>
                </div>

                <Button className="w-full py-6 rounded-2xl group" size="lg">
                  Contact Sales Team
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
