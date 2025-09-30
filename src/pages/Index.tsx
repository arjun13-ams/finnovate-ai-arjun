import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";
import { 
  Video, 
  TrendingUp, 
  Sparkles, 
  Newspaper,
  Zap,
  Shield,
  BarChart3
} from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="section-gradient py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Financial Intelligence</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Transform Data Into
              <span className="bg-gradient-primary bg-clip-text text-transparent"> Actionable Insights</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Harness the power of AI to summarize content, screen stocks, and generate perfect prompts. 
              Built for investors, creators, and innovators.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/auth">
                <Button size="lg" className="btn-primary text-lg px-8">
                  Get Started Free
                </Button>
              </Link>
              <Link to="/market-overview">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Explore Market Overview
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center justify-center space-x-8 text-sm text-muted-foreground pt-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Secure & Private</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span>Real-time Data</span>
              </div>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>AI-Powered</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-bold">
              Everything You Need in One Platform
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Four powerful AI tools designed to save you time and enhance decision-making
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <Card className="card-elevated p-8 space-y-4 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold">YouTube Summarizer</h3>
              <p className="text-muted-foreground">
                Get instant AI-powered summaries of any YouTube video with key points, 
                timestamps, and actionable insights. Perfect for research and content creation.
              </p>
              <Link to="/youtube-summarizer">
                <Button variant="ghost" className="hover:text-primary">
                  Learn more →
                </Button>
              </Link>
            </Card>

            <Card className="card-elevated p-8 space-y-4 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-2xl font-semibold">Stock Screener</h3>
              <p className="text-muted-foreground">
                Filter stocks using natural language queries. Our AI understands your criteria 
                and returns relevant matches with detailed explanations.
              </p>
              <Link to="/stock-screener">
                <Button variant="ghost" className="hover:text-primary">
                  Learn more →
                </Button>
              </Link>
            </Card>

            <Card className="card-elevated p-8 space-y-4 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold">Prompt Generator</h3>
              <p className="text-muted-foreground">
                Create perfect AI prompts through guided questions. Our system asks clarifying 
                questions to build the most effective prompt for your needs.
              </p>
              <Link to="/prompt-generator">
                <Button variant="ghost" className="hover:text-primary">
                  Learn more →
                </Button>
              </Link>
            </Card>

            <Card className="card-elevated p-8 space-y-4 hover:border-primary/50 transition-all">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Newspaper className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-2xl font-semibold">Market Overview</h3>
              <p className="text-muted-foreground">
                Stay updated with curated market news, analysis, and insights. 
                Free and unlimited access to keep you informed about market trends.
              </p>
              <Link to="/market-overview">
                <Button variant="ghost" className="hover:text-primary">
                  Learn more →
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold">
              Ready to Get Started?
            </h2>
            <p className="text-xl opacity-90">
              Join thousands of investors and creators using FinnovateAI to make smarter decisions faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Start Free Trial
                </Button>
              </Link>
              <Link to="/market-overview">
                <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
