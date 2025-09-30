import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TrendingUp, Lock } from "lucide-react";
import { Link } from "react-router-dom";

const StockScreener = () => {
  const [query, setQuery] = useState("");
  const isLoggedIn = false; // This will be connected to auth later

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="max-w-md p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Login Required</h2>
              <p className="text-muted-foreground">
                Please sign in to access the Stock Screener
              </p>
            </div>
            <Link to="/auth">
              <Button className="btn-primary w-full">
                Sign In
              </Button>
            </Link>
          </Card>
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center space-x-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              <span>Stock Screener</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              AI-Powered Stock Screening
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Describe what you're looking for in natural language
            </p>
          </div>

          <Card className="card-elevated p-8 mb-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Query</label>
                <Textarea
                  placeholder="Example: Show me tech stocks with P/E ratio under 20 and market cap over 1B"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rows={4}
                />
                <Button className="btn-primary w-full md:w-auto">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Screen Stocks
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Usage Limits:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Free Account:</strong> 3 queries per day</li>
                  <li>• <strong>Premium:</strong> Unlimited queries</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default StockScreener;
