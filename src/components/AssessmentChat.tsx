import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, ChevronRight, CheckCircle2, XCircle, Loader2, BrainCircuit, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { StudyNode, StudyLink, AssessmentQuestion } from '../types';
import { supabase } from '../services/supabase';
import { api } from '../services/api';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  type?: 'text' | 'options' | 'question' | 'result';
  options?: string[];
  questionData?: AssessmentQuestion;
}

interface AssessmentChatProps {
  node: StudyNode;
  onComplete: (passed: boolean, score: number) => void;
  initialLink?: StudyLink;
}

export default function AssessmentChat({ node, onComplete, initialLink }: AssessmentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [step, setStep] = useState<'selecting_content' | 'selecting_difficulty' | 'testing' | 'finished'>(
    initialLink ? 'selecting_difficulty' : 'selecting_content'
  );
  const [selectedLink, setSelectedLink] = useState<StudyLink | null>(initialLink || null);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'expert' | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const loadingMessages = [
    "Conectando com o cérebro da IA...",
    "Analisando o conteúdo do anexo...",
    "Criando perguntas complexas e desafiadoras...",
    "Refinando os distratores para testar seu nível...",
    "Quase lá! Finalizando a estrutura da prova...",
    "A IA está sendo meticulosa hoje, só mais um instante..."
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingMessageIndex(0);
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 15000); // Troca a cada 15 segundos
    }
    return () => clearInterval(interval);
  }, [loading]);
  const [finalResult, setFinalResult] = useState<{ passed: boolean, score: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleResetCache = async () => {
    if (!selectedLink || !difficulty) return;
    setIsResetting(true);
    try {
      await api.clearAssessmentCache(node.id, selectedLink.url, difficulty);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Cache limpo! Vou tentar gerar novas questões para você agora...' 
      }]);
      const newQuestions = await generateQuestions(selectedLink, difficulty);
      if (newQuestions.length > 0) {
        setStep('testing');
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: newQuestions[0].question,
            type: 'question',
            options: newQuestions[0].options,
            questionData: newQuestions[0]
          }
        ]);
      }
    } catch (error) {
      toast.error('Erro ao limpar cache');
    } finally {
      setIsResetting(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Inicializa o chat
  useEffect(() => {
    if (initialLink) {
      setMessages([
        {
          role: 'assistant',
          content: `Ótima escolha! Vamos praticar sobre: **${initialLink.title}**. 🚀\n\nAgora, selecione o nível de dificuldade que deseja enfrentar:`,
          type: 'options',
          options: ['Iniciante', 'Intermediário', 'Especialista']
        }
      ]);
    } else {
      setMessages([
        {
          role: 'assistant',
          content: `Olá! Sou seu Tutor de IA. Para liberar seu relatório, vamos passar por uma breve avaliação interativa. 🚀\n\nPrimeiro, escolha em qual conteúdo você quer focar seu teste:`,
          type: 'options',
          options: node.links.map(l => l.title)
        }
      ]);
    }
  }, [node, initialLink]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /**
   * Gera perguntas usando o Webhook do n8n baseado no conteúdo selecionado.
   * O n8n atua como orquestrador, processando o link e retornando as questões.
   */
  const generateQuestions = async (link: StudyLink, diff: string) => {
    setLoading(true);
    try {
      // Primeiro, verificamos se já existem perguntas no banco para este link e dificuldade (Cache Local)
      const cachedQuestions = await api.getAssessmentCache(node.id, link.url, diff);

      if (cachedQuestions && cachedQuestions.length >= 3) {
        // Sanitizar opções caso venham como string do banco
        const sanitized = cachedQuestions.map((q: any) => ({
          ...q,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
        })).filter((q: any) => q.question && q.options && q.options.length > 0);

        if (sanitized.length >= 3) {
          setQuestions(sanitized);
          return sanitized;
        }
      }

      // Se não houver no cache, chamamos o backend para gerar via n8n
      const generated = await api.generateAssessment({
        node_id: node.id,
        node_title: node.title,
        link_url: link.url,
        difficulty: diff,
        user_email: (await supabase.auth.getUser()).data.user?.email
      });
      
      const sanitizedGenerated = (Array.isArray(generated) ? generated : []).map((q: any) => {
        let finalOptions = q.options;
        if (typeof finalOptions === 'string') {
          try {
            finalOptions = JSON.parse(finalOptions);
          } catch (e) {
            // Se não for JSON, tenta dar split por vírgula ou quebra de linha
            finalOptions = finalOptions.split(/[,\n]/).map((o: string) => o.trim()).filter(Boolean);
          }
        }
        return {
          ...q,
          options: Array.isArray(finalOptions) ? finalOptions : []
        };
      }).filter((q: any) => q.question && q.options && q.options.length > 0);

      if (sanitizedGenerated.length === 0) {
        throw new Error("A IA gerou um formato inválido ou vazio. Por favor, tente novamente.");
      }

      setQuestions(sanitizedGenerated);
      return sanitizedGenerated;
    } catch (error: any) {
      console.error('Erro ao gerar perguntas:', error);
      // Fallback ou mensagem de erro amigável no chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Ops! Tive um problema ao conectar com meu cérebro de IA: ${error.message || 'Erro desconhecido'}. Isso pode acontecer se o cache estiver corrompido. Deseja tentar resetar o cache deste nível?`,
        type: 'options',
        options: ['Resetar Cache e Tentar Novamente', 'Tentar Novamente']
      }]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleOptionClick = async (option: string) => {
    if (step === 'selecting_content') {
      const link = node.links.find(l => l.title === option);
      if (link) {
        setSelectedLink(link);
        setMessages(prev => [
          ...prev,
          { role: 'user', content: option },
          { 
            role: 'assistant', 
            content: `Ótima escolha! Agora, qual o nível de dificuldade que você deseja?`,
            type: 'options',
            options: ['Iniciante', 'Intermediário', 'Especialista']
          }
        ]);
        setStep('selecting_difficulty');
      }
    } else if (step === 'selecting_difficulty') {
      if (option === 'Resetar Cache e Tentar Novamente') {
        await handleResetCache();
        return;
      }
      if (option === 'Tentar Novamente') {
        const generatedQuestions = await generateQuestions(selectedLink!, difficulty!);
        if (generatedQuestions.length > 0) {
          setStep('testing');
          setMessages(prev => [
            ...prev,
            { 
              role: 'assistant', 
              content: `Perfeito! Vamos começar o teste. Aqui está sua primeira pergunta:`,
            },
            {
              role: 'assistant',
              content: generatedQuestions[0].question,
              type: 'question',
              options: generatedQuestions[0].options,
              questionData: generatedQuestions[0]
            }
          ]);
        }
        return;
      }

      const diffMap: Record<string, 'beginner' | 'intermediate' | 'expert'> = {
        'Iniciante': 'beginner',
        'Intermediário': 'intermediate',
        'Especialista': 'expert'
      };
      const diff = diffMap[option] || difficulty;
      if (!diff) return;
      
      setDifficulty(diff);
      setMessages(prev => [...prev, { role: 'user', content: option }]);
      
      const generatedQuestions = await generateQuestions(selectedLink!, diff);
      
      if (generatedQuestions.length > 0) {
        setStep('testing');
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: `Perfeito! Vamos começar o teste. Aqui está sua primeira pergunta:`,
          },
          {
            role: 'assistant',
            content: generatedQuestions[0].question,
            type: 'question',
            options: generatedQuestions[0].options,
            questionData: generatedQuestions[0]
          }
        ]);
      }
    } else if (step === 'testing') {
      const currentQ = questions[currentQuestionIndex];
      // Usamos Number() para garantir a comparação correta, caso o banco retorne como string
      const selectedIndex = currentQ.options.indexOf(option);
      const isCorrect = selectedIndex === Number(currentQ.correct_answer);
      
      if (isCorrect) setScore(s => s + 1);

      setMessages(prev => [
        ...prev,
        { role: 'user', content: option },
        { 
          role: 'assistant', 
          content: isCorrect 
            ? '✅ Correto!' 
            : `❌ Incorreto. A resposta correta era: ${currentQ.options[Number(currentQ.correct_answer)]}`,
          type: 'text'
        },
        {
          role: 'assistant',
          content: `💡 Explicação: ${currentQ.explanation}`,
          type: 'text'
        }
      ]);

      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex);
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: questions[nextIndex].question,
              type: 'question',
              options: questions[nextIndex].options,
              questionData: questions[nextIndex]
            }
          ]);
        }, 1500);
      } else {
        setStep('finished');
        const finalScore = ((score + (isCorrect ? 1 : 0)) / questions.length) * 100;
        const passed = finalScore >= 60;
        setFinalResult({ passed, score: finalScore });

        setTimeout(async () => {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: passed 
                ? `🎉 Parabéns! Você atingiu ${finalScore.toFixed(0)}% de acerto e foi aprovado na avaliação. Clique no botão abaixo para finalizar e liberar seu relatório!`
                : `Poxa, você atingiu ${finalScore.toFixed(0)}%. Precisamos de pelo menos 60% para aprovar. Clique no botão abaixo para registrar sua tentativa e tente novamente!`,
              type: 'result'
            }
          ]);
        }, 1500);
      }
    }
  };

  const handleFinalize = async () => {
    if (!finalResult || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await api.saveTestResult({
          user_id: user.id,
          node_id: node.id,
          link_url: selectedLink?.url || '',
          difficulty: difficulty || '',
          score: finalResult.score,
          passed: finalResult.passed,
          chat_history: messages
        });
        onComplete(finalResult.passed, finalResult.score);
      }
    } catch (error) {
      console.error('Erro ao finalizar:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 bg-slate-950/50 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
      {/* Header do Chat */}
      <div className="bg-slate-900/80 p-4 pr-12 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2 rounded-lg">
            <BrainCircuit className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Tutor de IA Techify</h4>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span className="text-[10px] font-bold text-blue-400 uppercase">Beta</span>
        </div>
      </div>

      {/* Área de Mensagens */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-scroll p-6 space-y-6 custom-scrollbar pb-40 overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  {msg.role === 'assistant' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className="space-y-3 w-full">
                  <div className={`p-5 rounded-2xl text-lg leading-relaxed shadow-2xl ${
                    msg.role === 'assistant' 
                      ? 'bg-slate-700/40 border border-slate-600/50 text-white rounded-tl-none backdrop-blur-sm' 
                      : 'bg-blue-600 text-white rounded-tr-none'
                  }`}>
                    {msg.content}
                    {msg.role === 'assistant' && idx === messages.length - 1 && step === 'testing' && (
                      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
                        <button 
                          onClick={handleResetCache}
                          disabled={isResetting}
                          className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> {isResetting ? 'Resetando...' : 'Resetar Questões'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Opções Interativas */}
                  {msg.type === 'options' && (
                    <div className="flex flex-wrap gap-2">
                      {msg.options?.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleOptionClick(opt)}
                          className="bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white px-5 py-3 rounded-xl text-base font-bold transition-all flex items-center gap-2 group shadow-lg"
                        >
                          {opt}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Botões de Resposta da Pergunta */}
                  {msg.type === 'question' && (
                    <div className="grid grid-cols-1 gap-2">
                      {msg.options?.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleOptionClick(opt)}
                          className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-5 py-4 rounded-xl text-base font-medium transition-all flex items-center gap-4 shadow-md"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-sm font-bold text-slate-500 border border-slate-700">
                            {String.fromCharCode(65 + i)}
                          </div>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Resultado Final */}
                  {msg.type === 'result' && (
                    <div className="pt-4">
                      <button
                        onClick={handleFinalize}
                        disabled={isFinalizing}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg ${
                          finalResult?.passed 
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' 
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
                        }`}
                      >
                        {isFinalizing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            Finalizar Avaliação
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-4 items-center bg-slate-800/90 border border-slate-700 p-5 rounded-2xl rounded-tl-none shadow-xl">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-base text-slate-300 font-medium italic">{loadingMessages[loadingMessageIndex]}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer do Chat */}
      <div className="p-6 bg-slate-900 border-t border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10 flex-shrink-0">
        <div className="flex gap-3">
          <input 
            type="text"
            disabled
            placeholder="O chat é guiado por opções acima..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 text-base text-slate-500 outline-none cursor-not-allowed"
          />
          <button disabled className="bg-slate-800 p-3 rounded-xl text-slate-600">
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
