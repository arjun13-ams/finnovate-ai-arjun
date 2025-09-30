import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Video, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const YoutubeSummarizer = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!url) {
      toast({
        title: "URL Required",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Summary Generated!",
        description: "Your video summary is ready.",
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Video className="h-4 w-4" />
              <span>YouTube Summarizer</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Summarize Any YouTube Video
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get AI-powered summaries with key points, timestamps, and insights in seconds
            </p>
          </div>

          <Card className="card-elevated p-8 mb-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">YouTube URL</label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSummarize} 
                    disabled={isLoading}
                    className="btn-primary"
                  >
                    {isLoading ? (
                      "Processing..."
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Summarize
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Usage Limits:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>Guest:</strong> 3 summaries per day</li>
                  <li>• <strong>Free Account:</strong> 5 summaries per day</li>
                  <li>• <strong>Premium:</strong> Unlimited summaries</li>
                </ul>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">⚡</div>
              <h3 className="font-semibold mb-2">Lightning Fast</h3>
              <p className="text-sm text-muted-foreground">
                Get summaries in under 30 seconds
              </p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">🎯</div>
              <h3 className="font-semibold mb-2">Key Points</h3>
              <p className="text-sm text-muted-foreground">
                Extract the most important insights
              </p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">⏱️</div>
              <h3 className="font-semibold mb-2">Timestamps</h3>
              <p className="text-sm text-muted-foreground">
                Navigate to specific moments
              </p>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default YoutubeSummarizer;
