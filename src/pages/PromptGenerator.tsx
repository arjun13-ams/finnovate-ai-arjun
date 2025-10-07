import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Sparkles, Lock, Loader2, CheckCircle2, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = 'input' | 'questions' | 'result';

const PromptGenerator = () => {
  const [step, setStep] = useState<Step>('input');
  const [input, setInput] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState<{ model: string; confidence: string } | null>(null);
  const { user, loading } = useAuth();

  const handleStart = async () => {
    if (!input.trim()) {
      toast.error("Please describe what you want to create");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('prompt-generator', {
        body: {
          action: 'start',
          userInput: input
        }
      });

      if (error) throw error;

      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(''));
      setModelInfo({ model: data.model, confidence: data.confidence });
      setStep('questions');
      toast.success("Questions generated! Answer them to refine your prompt.");
    } catch (error) {
      console.error('Error:', error);
      toast.error("Failed to generate questions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const answeredQuestions = questions
        .map((q, i) => ({ question: q, answer: answers[i] || 'Not answered' }))
        .filter(qa => qa.answer !== 'Not answered');

      const { data, error } = await supabase.functions.invoke('prompt-generator', {
        body: {
          action: 'generate',
          userInput: input,
          answers: answeredQuestions
        }
      });

      if (error) throw error;

      setFinalPrompt(data.prompt);
      setModelInfo({ model: data.model, confidence: data.confidence });
      setStep('result');
      toast.success("Perfect prompt generated!");
    } catch (error) {
      console.error('Error:', error);
      toast.error("Failed to generate prompt. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(finalPrompt);
    toast.success("Prompt copied to clipboard!");
  };

  const handleReset = () => {
    setStep('input');
    setInput('');
    setQuestions([]);
    setAnswers([]);
    setFinalPrompt('');
    setModelInfo(null);
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
                Please sign in to access the Prompt Generator
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
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              <span>Prompt Generator</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Create Perfect AI Prompts
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our AI asks clarifying questions to build the ideal prompt for your needs
            </p>
          </div>

          {/* Step 1: Initial Input */}
          {step === 'input' && (
            <Card className="card-elevated p-8 mb-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">What do you want to create?</label>
                  <Textarea
                    placeholder="Example: I want to write a blog post about sustainable investing"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={4}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleStart();
                      }
                    }}
                  />
                  <Button 
                    className="btn-primary w-full md:w-auto"
                    onClick={handleStart}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Questions...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-muted/50 rounded-lg p-6">
                  <h3 className="font-semibold mb-4">How it works:</h3>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Describe your goal in simple terms</li>
                    <li>Answer 5 optional clarifying questions</li>
                    <li>Get a perfectly structured AI prompt</li>
                    <li>Use it with any AI tool (ChatGPT, Claude, etc.)</li>
                  </ol>
                </div>

                <div className="bg-muted/50 rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Usage Limits:</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <strong>Free Account:</strong> 3 prompts per day</li>
                    <li>• <strong>Premium:</strong> Unlimited prompts</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Step 2: Clarifying Questions */}
          {step === 'questions' && (
            <Card className="card-elevated p-8 mb-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Your Goal</h3>
                  <p className="text-sm bg-muted/50 p-4 rounded">{input}</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Clarifying Questions (Optional)</h3>
                  <p className="text-sm text-muted-foreground">
                    Answer these questions to help us create a better prompt. You can skip any question.
                  </p>
                  
                  {questions.map((question, idx) => (
                    <div key={idx} className="space-y-2">
                      <label className="text-sm font-medium">
                        {idx + 1}. {question}
                      </label>
                      <Input
                        placeholder="Your answer (optional)"
                        value={answers[idx]}
                        onChange={(e) => {
                          const newAnswers = [...answers];
                          newAnswers[idx] = e.target.value;
                          setAnswers(newAnswers);
                        }}
                      />
                    </div>
                  ))}
                </div>

                {modelInfo && (
                  <div className="text-xs text-muted-foreground">
                    Model: {modelInfo.model} | Confidence: {modelInfo.confidence}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    className="btn-primary"
                    onClick={handleGenerate}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Prompt...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Prompt
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Start Over
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Final Prompt */}
          {step === 'result' && (
            <Card className="card-elevated p-8 mb-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Your Perfect Prompt</h3>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-sm whitespace-pre-wrap flex-1">{finalPrompt}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {modelInfo && (
                  <div className="text-xs text-muted-foreground">
                    Generated with: {modelInfo.model} | Confidence: {modelInfo.confidence}
                  </div>
                )}

                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Next Steps:</p>
                  <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Copy the prompt above</li>
                    <li>Paste it into ChatGPT, Claude, or any AI tool</li>
                    <li>Get amazing results!</li>
                  </ol>
                </div>

                <Button variant="outline" onClick={handleReset}>
                  Create Another Prompt
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PromptGenerator;
