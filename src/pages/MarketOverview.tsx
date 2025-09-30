import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Newspaper, TrendingUp, TrendingDown } from "lucide-react";

const marketNews = [
  {
    id: 1,
    title: "Tech Stocks Rally on Strong Earnings Reports",
    excerpt: "Major technology companies exceeded expectations in Q4, driving market optimism...",
    date: "2 hours ago",
    trend: "up",
  },
  {
    id: 2,
    title: "Federal Reserve Maintains Interest Rates",
    excerpt: "The Fed decided to keep rates steady amid mixed economic signals...",
    date: "5 hours ago",
    trend: "neutral",
  },
  {
    id: 3,
    title: "Energy Sector Faces Headwinds",
    excerpt: "Oil prices decline as demand forecasts are revised downward...",
    date: "8 hours ago",
    trend: "down",
  },
  {
    id: 4,
    title: "Emerging Markets Show Strong Growth",
    excerpt: "Asian markets lead gains as regional economies recover faster than expected...",
    date: "1 day ago",
    trend: "up",
  },
];

const MarketOverview = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center space-x-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
              <Newspaper className="h-4 w-4" />
              <span>Market Overview</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Latest Market News & Insights
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Stay informed with curated financial news and analysis
            </p>
          </div>

          <div className="grid gap-6">
            {marketNews.map((news) => (
              <Card key={news.id} className="card-elevated p-6 hover:border-primary/50 transition-all cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      {news.trend === "up" && (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      )}
                      {news.trend === "down" && (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm text-muted-foreground">{news.date}</span>
                    </div>
                    <h3 className="text-xl font-semibold hover:text-primary transition-colors">
                      {news.title}
                    </h3>
                    <p className="text-muted-foreground">{news.excerpt}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Card className="inline-block p-6 bg-muted/50">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Newspaper className="h-5 w-5" />
                <span className="text-sm">
                  Free & unlimited access • Updates every hour
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MarketOverview;
