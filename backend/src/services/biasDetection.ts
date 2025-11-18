/**
 * Bias Detection & NLP Service - AI Integration Module
 * Owner: Yanxiao Zheng
 * 
 * Provides unified interface for analyzing peer review comments for:
 * - Toxicity and harsh language
 * - Politeness and constructive tone
 * - Identity-based bias and discrimination
 * - Sentiment analysis
 * 
 * Supports multiple AI providers: OpenAI, Anthropic, Azure, Perspective API, Mock
 */

export interface AnalysisContext {
  courseId: string;
  submissionId: string;
  reviewerId: string;
  locale?: string;
}

export interface IdentityMention {
  type: 'gender' | 'race' | 'religion' | 'disability' | 'nationality' | 'age' | 'other';
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface RiskSegment {
  start: number;
  end: number;
  text: string;
  riskType: 'toxicity' | 'identity_attack' | 'harsh_language' | 'discriminatory';
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
}

export interface BiasAnalysisResult {
  // Numerical scores (0.0 to 1.0)
  toxicityScore: number;
  politenessScore: number;
  sentimentScore: number; // -1.0 (negative) to 1.0 (positive)
  
  // Detected issues
  identityMentions: IdentityMention[];
  riskSegments: RiskSegment[];
  
  // Overall assessment
  hasHighRisk: boolean;
  overallSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  
  // AI-generated suggestions
  suggestedRewrite?: string;
  improvementTips: string[];
  
  // Metadata
  modelVersion: string;
  processingTimeMs: number;
}

export interface BiasDetectionService {
  /**
   * Analyze a comment for bias, toxicity, and politeness.
   * 
   * @param text - The review comment text to analyze
   * @param context - Context about the review (course, submission, reviewer)
   * @returns Analysis results with scores and suggestions
   */
  analyzeComment(text: string, context: AnalysisContext): Promise<BiasAnalysisResult>;
  
  /**
   * Generate a constructive rewrite suggestion for a problematic comment.
   * 
   * @param text - Original comment text
   * @param issues - Identified issues from analysis
   * @returns Suggested rewrite with explanation
   */
  generateRewriteSuggestion(
    text: string, 
    issues: RiskSegment[]
  ): Promise<{
    rewrittenText: string;
    explanation: string;
    changesApplied: string[];
  }>;
  
  /**
   * Batch analyze multiple comments (for instructor dashboard).
   * 
   * @param comments - Array of comments with their contexts
   * @returns Array of analysis results
   */
  batchAnalyze(
    comments: { text: string; context: AnalysisContext }[]
  ): Promise<BiasAnalysisResult[]>;
}

/**
 * Get the appropriate bias detection service based on environment configuration.
 */
export function getBiasDetectionService(): BiasDetectionService {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  
  switch (provider) {
    case 'openai':
      return new OpenAIBiasDetectionService();
    case 'anthropic':
      return new AnthropicBiasDetectionService();
    case 'azure':
      return new AzureOpenAIBiasDetectionService();
    case 'perspective':
      return new PerspectiveBiasDetectionService();
    case 'mock':
    default:
      return new MockBiasDetectionService();
  }
}

/**
 * Mock implementation for development and testing.
 * Returns synthetic bias analysis results based on heuristics.
 */
export class MockBiasDetectionService implements BiasDetectionService {
  async analyzeComment(text: string, context: AnalysisContext): Promise<BiasAnalysisResult> {
    const startTime = Date.now();
    
    // Simple heuristic-based mock analysis
    const lowerText = text.toLowerCase();
    
    // Toxicity heuristics
    const toxicWords = ['stupid', 'idiot', 'terrible', 'awful', 'garbage', 'worthless', 'useless'];
    const toxicityScore = this.calculateScore(lowerText, toxicWords, 0.15);
    
    // Politeness heuristics (look for polite markers)
    const politeMarkers = ['please', 'thank', 'consider', 'suggest', 'might', 'could', 'perhaps'];
    const politenessScore = this.calculateScore(lowerText, politeMarkers, 0.1, true);
    
    // Sentiment heuristics
    const positiveWords = ['good', 'great', 'excellent', 'well', 'clear', 'strong'];
    const negativeWords = ['bad', 'poor', 'weak', 'unclear', 'confusing', 'wrong'];
    const sentimentScore = this.calculateSentiment(lowerText, positiveWords, negativeWords);
    
    // Identity mention detection (very basic)
    const identityMentions = this.detectIdentityMentions(text);
    
    // Risk segments
    const riskSegments = this.identifyRiskSegments(text, toxicWords);
    
    // Overall risk assessment
    const toxicityThreshold = parseFloat(process.env.AI_TOXICITY_THRESHOLD || '0.7');
    const politenessThreshold = parseFloat(process.env.AI_POLITENESS_THRESHOLD || '0.3');
    
    const hasHighRisk = 
      toxicityScore >= toxicityThreshold ||
      politenessScore < politenessThreshold ||
      identityMentions.length > 0 ||
      riskSegments.some(s => s.severity === 'high' || s.severity === 'critical');
    
    let overallSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    if (toxicityScore >= 0.85 || riskSegments.some(s => s.severity === 'critical')) {
      overallSeverity = 'critical';
    } else if (toxicityScore >= 0.7 || politenessScore < 0.2) {
      overallSeverity = 'high';
    } else if (toxicityScore >= 0.5 || politenessScore < 0.4) {
      overallSeverity = 'medium';
    } else if (toxicityScore >= 0.3 || politenessScore < 0.6) {
      overallSeverity = 'low';
    }
    
    const improvementTips: string[] = [];
    if (toxicityScore > 0.5) {
      improvementTips.push('Consider using more constructive language');
    }
    if (politenessScore < 0.5) {
      improvementTips.push('Add polite phrases like "I suggest" or "You might consider"');
    }
    if (sentimentScore < -0.3) {
      improvementTips.push('Balance critique with acknowledgment of strengths');
    }
    if (identityMentions.length > 0) {
      improvementTips.push('Avoid mentioning personal characteristics; focus on the work');
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      toxicityScore,
      politenessScore,
      sentimentScore,
      identityMentions,
      riskSegments,
      hasHighRisk,
      overallSeverity,
      improvementTips,
      modelVersion: process.env.AI_MODEL_VERSION || 'mock-v1.0',
      processingTimeMs
    };
  }
  
  async generateRewriteSuggestion(
    text: string,
    issues: RiskSegment[]
  ): Promise<{ rewrittenText: string; explanation: string; changesApplied: string[] }> {
    // Simple rule-based rewriting for mock
    let rewritten = text;
    const changesApplied: string[] = [];
    
    // Replace toxic words with constructive alternatives
    const replacements: Record<string, string> = {
      'stupid': 'unclear',
      'idiot': 'person',
      'terrible': 'needs improvement',
      'awful': 'could be better',
      'garbage': 'not optimal',
      'worthless': 'needs development',
      'useless': 'not effective'
    };
    
    for (const [toxic, alternative] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${toxic}\\b`, 'gi');
      if (regex.test(rewritten)) {
        rewritten = rewritten.replace(regex, alternative);
        changesApplied.push(`Replaced harsh term "${toxic}" with constructive "${alternative}"`);
      }
    }
    
    // Add polite prefix if needed
    if (issues.length > 0 && !rewritten.match(/^(I suggest|Consider|You might|Perhaps)/i)) {
      rewritten = 'I suggest: ' + rewritten;
      changesApplied.push('Added polite introductory phrase');
    }
    
    const explanation = issues.length > 0
      ? `Rewrote to address ${issues.length} identified issue(s): ${issues.map(i => i.riskType).join(', ')}`
      : 'Minor improvements for constructive tone';
    
    return {
      rewrittenText: rewritten,
      explanation,
      changesApplied
    };
  }
  
  async batchAnalyze(
    comments: { text: string; context: AnalysisContext }[]
  ): Promise<BiasAnalysisResult[]> {
    // Process sequentially for mock (real implementation would parallelize)
    return Promise.all(comments.map(c => this.analyzeComment(c.text, c.context)));
  }
  
  private calculateScore(text: string, keywords: string[], weight: number, inverse: boolean = false): number {
    let matches = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const found = text.match(regex);
      if (found) matches += found.length;
    }
    
    const score = Math.min(1.0, matches * weight);
    return inverse ? 1.0 - score : score;
  }
  
  private calculateSentiment(text: string, positive: string[], negative: string[]): number {
    const posScore = this.calculateScore(text, positive, 0.1);
    const negScore = this.calculateScore(text, negative, 0.1);
    return posScore - negScore; // Range: -1.0 to 1.0
  }
  
  private detectIdentityMentions(text: string): IdentityMention[] {
    const identityPatterns = [
      { type: 'gender' as const, patterns: ['he', 'she', 'him', 'her', 'his', 'hers', 'man', 'woman', 'male', 'female', 'guy', 'girl', 'boy'] },
      { type: 'race' as const, patterns: ['black', 'white', 'asian', 'hispanic', 'latino', 'african', 'caucasian'] },
      { type: 'religion' as const, patterns: ['christian', 'muslim', 'jewish', 'hindu', 'buddhist', 'atheist'] },
      { type: 'nationality' as const, patterns: ['american', 'chinese', 'indian', 'european', 'foreign', 'immigrant'] },
    ];
    
    const mentions: IdentityMention[] = [];
    const lowerText = text.toLowerCase();
    
    for (const { type, patterns } of identityPatterns) {
      for (const pattern of patterns) {
        const regex = new RegExp(`\\b${pattern}\\w*\\b`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          mentions.push({
            type,
            text: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.8
          });
        }
      }
    }
    
    return mentions;
  }
  
  private identifyRiskSegments(text: string, toxicWords: string[]): RiskSegment[] {
    const segments: RiskSegment[] = [];
    
    for (const word of toxicWords) {
      const regex = new RegExp(`\\b${word}\\w*\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const contextStart = Math.max(0, match.index - 20);
        const contextEnd = Math.min(text.length, match.index + match[0].length + 20);
        
        segments.push({
          start: contextStart,
          end: contextEnd,
          text: text.substring(contextStart, contextEnd),
          riskType: 'harsh_language',
          severity: 'medium',
          explanation: `Contains harsh language: "${match[0]}"`
        });
      }
    }
    
    return segments;
  }
}

/**
 * OpenAI-based implementation (stub for future implementation).
 */
export class OpenAIBiasDetectionService implements BiasDetectionService {
  async analyzeComment(text: string, context: AnalysisContext): Promise<BiasAnalysisResult> {
    // TODO: Implement OpenAI API integration
    // 1. Use GPT-4 with specialized prompt for bias detection
    // 2. Parse structured JSON response
    // 3. Map to BiasAnalysisResult format
    console.warn('OpenAI integration not yet implemented, falling back to mock');
    return new MockBiasDetectionService().analyzeComment(text, context);
  }
  
  async generateRewriteSuggestion(text: string, issues: RiskSegment[]) {
    console.warn('OpenAI rewrite not yet implemented, falling back to mock');
    return new MockBiasDetectionService().generateRewriteSuggestion(text, issues);
  }
  
  async batchAnalyze(comments: { text: string; context: AnalysisContext }[]) {
    console.warn('OpenAI batch analysis not yet implemented, falling back to mock');
    return new MockBiasDetectionService().batchAnalyze(comments);
  }
}

/**
 * Anthropic Claude-based implementation (stub for future implementation).
 */
export class AnthropicBiasDetectionService implements BiasDetectionService {
  async analyzeComment(text: string, context: AnalysisContext): Promise<BiasAnalysisResult> {
    // TODO: Implement Anthropic API integration
    console.warn('Anthropic integration not yet implemented, falling back to mock');
    return new MockBiasDetectionService().analyzeComment(text, context);
  }
  
  async generateRewriteSuggestion(text: string, issues: RiskSegment[]) {
    console.warn('Anthropic rewrite not yet implemented, falling back to mock');
    return new MockBiasDetectionService().generateRewriteSuggestion(text, issues);
  }
  
  async batchAnalyze(comments: { text: string; context: AnalysisContext }[]) {
    console.warn('Anthropic batch analysis not yet implemented, falling back to mock');
    return new MockBiasDetectionService().batchAnalyze(comments);
  }
}

/**
 * Azure OpenAI-based implementation (stub for future implementation).
 */
export class AzureOpenAIBiasDetectionService implements BiasDetectionService {
  async analyzeComment(text: string, context: AnalysisContext): Promise<BiasAnalysisResult> {
    // TODO: Implement Azure OpenAI API integration
    console.warn('Azure OpenAI integration not yet implemented, falling back to mock');
    return new MockBiasDetectionService().analyzeComment(text, context);
  }
  
  async generateRewriteSuggestion(text: string, issues: RiskSegment[]) {
    console.warn('Azure OpenAI rewrite not yet implemented, falling back to mock');
    return new MockBiasDetectionService().generateRewriteSuggestion(text, issues);
  }
  
  async batchAnalyze(comments: { text: string; context: AnalysisContext }[]) {
    console.warn('Azure OpenAI batch analysis not yet implemented, falling back to mock');
    return new MockBiasDetectionService().batchAnalyze(comments);
  }
}

/**
 * Google Perspective API-based implementation (stub for future implementation).
 */
export class PerspectiveBiasDetectionService implements BiasDetectionService {
  async analyzeComment(text: string, context: AnalysisContext): Promise<BiasAnalysisResult> {
    // TODO: Implement Perspective API integration
    // Perspective API provides toxicity, identity attack, etc. scores
    console.warn('Perspective API integration not yet implemented, falling back to mock');
    return new MockBiasDetectionService().analyzeComment(text, context);
  }
  
  async generateRewriteSuggestion(text: string, issues: RiskSegment[]) {
    // Perspective doesn't provide rewrite, would need to combine with LLM
    console.warn('Perspective API rewrite not yet implemented, falling back to mock');
    return new MockBiasDetectionService().generateRewriteSuggestion(text, issues);
  }
  
  async batchAnalyze(comments: { text: string; context: AnalysisContext }[]) {
    console.warn('Perspective API batch analysis not yet implemented, falling back to mock');
    return new MockBiasDetectionService().batchAnalyze(comments);
  }
}
