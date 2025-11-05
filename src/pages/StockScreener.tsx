import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getStockData } from "@/lib/stockData";
import { parseQueryRegex } from "@/lib/regexParser";
import { screenStocks } from "@/lib/screenExecutor";

const CACHE_KEY = 'stock_screener_data';
const CACHE_TIMESTAMP_KEY = 'stock_screener_data_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const StockScreener = () => {
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [parsedQuery, setParsedQuery] = useState<any>(null);
  const [datasetStats, setDatasetStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const { user, loading } = useAuth();
  const { toast } = useToast();

  // Load dataset stats on mount
  useEffect(() => {
    if (user && !isLoadingStats && !datasetStats) {
      loadDatasetStats();
    }
  }, [user]);

  const loadDatasetStats = async () => {
    setIsLoadingStats(true);
    try {
      const stockData = await getStockData();
      const uniqueSymbols = new Set(stockData.map(r => r.symbol)).size;
      const dateFrom = stockData.length > 0 ? stockData[0].date : null;
      const dateTo = stockData.length > 0 ? stockData[stockData.length - 1].date : null;
      
      setDatasetStats({
        uniqueSymbols,
        recordCount: stockData.length,
        dateFrom,
        dateTo
      });
    } catch (error: any) {
      console.error('Failed to load dataset stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleScreenStocks = async () => {
    if (!query.trim()) {
      toast({
        title: "Query required",
        description: "Please enter a screening query",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setParsedQuery(null);

    try {
      console.log('🔍 Parsing query:', query.trim());
      
      // Step 1: Try regex parser first
      const regexResult = parseQueryRegex(query.trim());
      let parsedFilter;
      
      if (regexResult.success) {
        console.log('✅ Regex parser succeeded');
        parsedFilter = regexResult.filter!;
      } else {
        console.log('⚠️ Regex parser failed, falling back to LLM...');
        
        // Step 2: Fallback to LLM parser
        const { data: llmData, error: llmError } = await supabase.functions.invoke('stock-screener', {
          body: { query: query.trim() }
        });
        
        if (llmError) throw llmError;
        if (!llmData?.parsedQuery) throw new Error('LLM parser failed');
        
        parsedFilter = llmData.parsedQuery;
        console.log('✅ LLM parser succeeded');
      }
      
      console.log('[Parser] Type:', parsedFilter.parser);
      setParsedQuery({
        ...parsedFilter,
        userQuery: query.trim(),
        technicalQuery: parsedFilter.conditions
      });
      
      // Step 3: Fetch stock data
      console.log('📊 Fetching stock data...');
      const stockData = await getStockData();
      
      // Calculate stats
      const uniqueSymbols = new Set(stockData.map(r => r.symbol)).size;
      const dateFrom = stockData.length > 0 ? stockData[0].date : null;
      const dateTo = stockData.length > 0 ? stockData[stockData.length - 1].date : null;
      
      setDatasetStats({
        uniqueSymbols,
        recordCount: stockData.length,
        dateFrom,
        dateTo
      });
      
      // Step 4: Screen stocks
      console.log('🔍 Screening stocks...');
      const filteredResults = await screenStocks(stockData, parsedFilter);
      
      console.log('Found results:', filteredResults.length);
      setResults(filteredResults);
      
      toast({
        title: "Screening complete",
        description: `Found ${filteredResults.length} stocks matching your criteria`,
      });
    } catch (error: any) {
      console.error('Stock screening error:', error);
      toast({
        title: "Screening failed",
        description: error.message || "Failed to screen stocks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
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
                Please sign in to access Screener.AI
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
              <Sparkles className="h-4 w-4" />
              <span>Screener.AI</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              AI-Powered Stock Screening
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Describe what you're looking for in natural language
            </p>
          </div>

          {datasetStats && (
            <Card className="card-elevated p-6 mb-8">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Data Snapshot
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Unique Stocks:</span>
                  <span className="ml-2 font-medium">{datasetStats.uniqueSymbols}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Records:</span>
                  <span className="ml-2 font-medium">{datasetStats.recordCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">From:</span>
                  <span className="ml-2 font-medium">{datasetStats.dateFrom || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">To:</span>
                  <span className="ml-2 font-medium">{datasetStats.dateTo || '—'}</span>
                </div>
              </div>
            </Card>
          )}

          <Card className="card-elevated p-8 mb-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Query</label>
                <Textarea
                  placeholder="Example: RSI below 30 and volume spike 2x SMA 20"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleScreenStocks();
                    }
                  }}
                  rows={4}
                />
                <Button 
                  className="btn-primary w-full md:w-auto" 
                  onClick={handleScreenStocks}
                  disabled={isProcessing || !query.trim()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Screening...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Screen Stocks
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Example Queries:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• RSI below 30</li>
                  <li>• Price crossed above SMA 50</li>
                  <li>• Volume spike 2× SMA 20</li>
                  <li>• MACD crossed above signal</li>
                  <li>• CCI greater than 100</li>
                </ul>
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

          {parsedQuery && (
            <Card className="card-elevated p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4">Query Analysis</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Parser:</span>
                    <span className="ml-2 font-medium capitalize">{parsedQuery.parser}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confidence:</span>
                    <span className={`ml-2 font-medium capitalize ${
                      parsedQuery.confidence === 'high' ? 'text-green-600' : 
                      parsedQuery.confidence === 'medium' ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>{parsedQuery.confidence}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="ml-2 font-medium">{parsedQuery.category}</span>
                  </div>
                  {parsedQuery.modelUsed && (
                    <div className="col-span-2 md:col-span-1">
                      <span className="text-muted-foreground">Model:</span>
                      <span className="ml-2 font-medium text-xs">{parsedQuery.modelUsed}</span>
                    </div>
                  )}
                </div>

                {parsedQuery.userQuery && (
                  <div className="pt-3 border-t">
                    <span className="text-muted-foreground text-sm font-medium">User Input:</span>
                    <p className="mt-1 text-sm bg-muted/30 p-3 rounded">{parsedQuery.userQuery}</p>
                  </div>
                )}

                {parsedQuery.technicalQuery && (
                  <div className="pt-3 border-t">
                    <span className="text-muted-foreground text-sm font-medium">Technical Query:</span>
                    <pre className="mt-1 text-xs bg-muted/30 p-3 rounded overflow-x-auto">{JSON.stringify(parsedQuery.technicalQuery, null, 2)}</pre>
                  </div>
                )}
              </div>
            </Card>
          )}


          {(results.length > 0 || parsedQuery) && (
            <Card className="card-elevated p-8">
              <h3 className="text-xl font-semibold mb-4">
                Screening Results ({results.length} stocks)
              </h3>
              {results.length === 0 && parsedQuery && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No stocks match your criteria. Try adjusting your query.</p>
                </div>
              )}
              {results.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Symbol</th>
                        <th className="text-right py-2 px-4">Close</th>
                        <th className="text-right py-2 px-4">Volume</th>
                        <th className="text-right py-2 px-4">Change %</th>
                        <th className="text-right py-2 px-4">Indicator</th>
                        <th className="text-right py-2 px-4">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((stock, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-4 font-medium">{stock.symbol}</td>
                          <td className="text-right py-2 px-4">${stock.close?.toFixed(2)}</td>
                          <td className="text-right py-2 px-4">{stock.volume?.toLocaleString()}</td>
                          <td className={`text-right py-2 px-4 ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stock.change?.toFixed(2)}%
                          </td>
                          <td className="text-right py-2 px-4 text-xs text-muted-foreground uppercase">
                            {stock.indicator_name}
                          </td>
                          <td className="text-right py-2 px-4 font-medium">
                            {stock.indicator_value?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default StockScreener;