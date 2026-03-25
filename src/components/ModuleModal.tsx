/**
 * ModuleModal.tsx - Modal de detalhes do módulo.
 * Permite ao aluno visualizar materiais, enviar relatórios de aprendizado e anexar arquivos.
 * Para o instrutor, exibe apenas os materiais de estudo.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Book, Youtube, GraduationCap, Copy, Check, Send, MessageSquare, AlertCircle, Paperclip, FileText, Trash2, BrainCircuit, HelpCircle, Star, XCircle } from 'lucide-react';
import { StudyNode, StudyLink, LearningReport, NodeStatus, AssessmentResult } from '../types';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import AssessmentChat from './AssessmentChat';

interface ModuleModalProps {
  node: StudyNode | null;
  onClose: () => void;
  onComplete: (nodeId: string) => void;
  isAdmin?: boolean;
}

const iconMap = {
  course: <GraduationCap className="w-5 h-5 text-blue-400" />,
  youtube: <Youtube className="w-5 h-5 text-red-500" />,
  reference: <Book className="w-5 h-5 text-slate-400" />,
};

export default function ModuleModal({ node, onClose, onComplete, isAdmin }: ModuleModalProps) {
  // Estados para gerenciar o relatório, anexos e status de envio
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<string>('');
  const [existingReport, setExistingReport] = useState<LearningReport | null>(null);
  const [assessmentResults, setAssessmentResults] = useState<any[]>([]);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Busca o relatório existente do usuário para este módulo específico ao abrir o modal.
   */
  useEffect(() => {
    if (node) {
      fetchReport();
      fetchAssessmentResult();
    } else {
      // Limpa os campos ao fechar o modal
      setReport('');
      setExistingReport(null);
      setAssessmentResults([]);
      setShowAssessment(false);
      setAttachments([]);
    }
  }, [node]);

  const fetchAssessmentResult = async () => {
    if (!node) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const data = await api.getTestResults(user.id, node.id);

    if (Array.isArray(data)) {
      setAssessmentResults(data);
    }
  };

  /**
   * Busca o relatório do usuário no banco de dados.
   */
  const fetchReport = async () => {
    if (!node) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const data = await api.getReportByNode(node.id, user.id);

    if (data) {
      setExistingReport(data);
      setReport(data.content);
      setAttachments(data.attachments || []);
    } else {
      setExistingReport(null);
      setReport('');
      setAttachments([]);
    }
    setLoading(false);
  };

  /**
   * Gerencia o upload de arquivos para o Supabase Storage.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !node) return;

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newAttachments = [...attachments];

    for (const fileObj of Array.from(files)) {
      const file = fileObj as File;
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${node.id}/${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, file);

      if (uploadError) {
        toast.error('Erro ao subir arquivo: ' + uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(fileName);

      newAttachments.push(publicUrl);
    }

    setAttachments(newAttachments);
    setUploading(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmitReport = async () => {
    if (!node || !report.trim()) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const reportData: any = {
      user_id: user.id,
      node_id: node.id,
      content: report,
      attachments: attachments,
      status: 'pending', // Always reset to pending on submission
      updated_at: new Date().toISOString()
    };

    if (existingReport?.id) {
      reportData.id = existingReport.id;
    }

    try {
      await api.saveReport(reportData);
      toast.success('Relatório enviado com sucesso!');
      await fetchReport();
    } catch (error: any) {
      toast.error('Erro ao enviar relatório: ' + error.message);
    }
    setSubmitting(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canComplete = existingReport?.status === 'approved' || node?.status === NodeStatus.Completed;
  
  // Verifica se o aluno passou em todos os níveis (beginner, intermediate, expert) para cada link do módulo
  const getCompletionStats = () => {
    if (!node || isAdmin) return { passed: true, total: 0, completed: 0 };
    
    const levels = ['beginner', 'intermediate', 'expert'];
    const totalRequired = node.links.length * levels.length;
    let completedCount = 0;

    node.links.forEach(link => {
      levels.forEach(level => {
        const hasPassed = assessmentResults.some(r => 
          r.link_url === link.url && 
          r.difficulty === level && 
          r.passed === true
        );
        if (hasPassed) completedCount++;
      });
    });

    return {
      passed: completedCount >= totalRequired,
      total: totalRequired,
      completed: completedCount
    };
  };

  const stats = getCompletionStats();
  const isAssessmentPassed = stats.passed;

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`bg-slate-900 border border-slate-700/80 rounded-2xl w-full transition-all duration-500 shadow-2xl shadow-blue-900/20 relative flex flex-col ${showAssessment ? 'max-w-[95vw] h-[90vh] m-0' : 'max-w-5xl my-4'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${showAssessment ? 'p-2 md:p-4 overflow-hidden h-full' : 'p-4 md:p-8'} flex flex-col min-h-0`}>
              <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors z-50">
                <X className="w-6 h-6" />
              </button>
              
              {!showAssessment && (
                <>
                  <h2 className="text-xl md:text-2xl font-bold text-blue-400 mb-2">{node.title}</h2>
                  <p className="text-sm md:text-base text-slate-400 mb-6">{node.description}</p>
                </>
              )}

              <div className={`${showAssessment ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8'}`}>
                {/* Links Section */}
                {!showAssessment && (
                  <div className={`${isAdmin ? '' : 'md:col-span-2'} space-y-6`}>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Materiais de Estudo</h3>
                        <div className="relative">
                          <button 
                            onClick={() => setShowHelp(!showHelp)}
                            className="text-slate-600 hover:text-blue-400 transition-colors"
                          >
                            <HelpCircle className="w-4 h-4 cursor-help" />
                          </button>
                          {showHelp && (
                            <div className="absolute left-0 bottom-full mb-2 w-80 bg-slate-800 text-[11px] text-slate-200 p-4 rounded-xl border border-slate-700 shadow-2xl z-50 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-blue-400 uppercase tracking-wider">Instruções de Conclusão</span>
                                <button onClick={() => setShowHelp(false)} className="text-slate-500 hover:text-white">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              Para concluir o módulo e liberar o envio do relatório, você deve passar nos 3 níveis (Iniciante, Intermediário e Especialista) de cada material de estudo listado ao lado.
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`grid ${isAdmin ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-3`}>
                        {node.links.map((link: StudyLink, index: number) => (
                          <div key={index} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              {iconMap[link.type]}
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-blue-300 transition-colors line-clamp-1">
                                {link.title}
                              </a>
                            </div>
                            {link.credentials && (
                              <button onClick={() => handleCopy(link.credentials!)} className="text-slate-500 hover:text-white transition-colors">
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detalhamento de Testes - Moved to left column */}
                    {!isAdmin && (
                      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Status Detalhado por Material</span>
                        <div className="space-y-3">
                          {node.links.map((link, lIdx) => (
                            <div key={lIdx} className="space-y-2">
                              <p className="text-[10px] font-medium text-slate-400 truncate">{link.title}</p>
                              <div className="grid grid-cols-3 gap-2">
                                {['beginner', 'intermediate', 'expert'].map((level) => {
                                  const result = assessmentResults.find(r => r.link_url === link.url && r.difficulty === level);
                                  const isPassed = result?.passed === true;
                                  
                                  return (
                                    <div 
                                      key={level}
                                      className={`p-2 rounded-lg border text-center transition-all ${
                                        result 
                                          ? isPassed 
                                            ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                                            : 'bg-red-500/10 border-red-500/30 text-red-500'
                                          : 'bg-slate-900/50 border-slate-800 text-slate-600'
                                      }`}
                                    >
                                      <p className="text-[8px] font-black uppercase tracking-tighter mb-1">
                                        {level === 'beginner' ? 'Iniciante' : level === 'intermediate' ? 'Interm.' : 'Especialista'}
                                      </p>
                                      {result ? (
                                        <div className="flex items-center justify-center gap-1">
                                          {isPassed ? <Star className="w-2 h-2 fill-current" /> : <XCircle className="w-2 h-2" />}
                                          <span className="text-[10px] font-bold">{Number(result.score).toFixed(0)}%</span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] font-bold opacity-50">Pendente</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Report Section - Hidden for Admin */}
                {!isAdmin && (
                  <div className={`${showAssessment ? 'flex-1 min-h-0 flex flex-col' : 'md:col-span-3 space-y-4'}`}>
                    {!showAssessment && (
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Avaliação & Relatório</h3>
                        {isAssessmentPassed ? (
                          <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                            <Check className="w-3 h-3" /> Avaliação Concluída
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
                            Progresso: {stats.completed}/{stats.total} testes
                          </span>
                        )}
                      </div>
                    )}
                    
                    {!isAssessmentPassed && !showAssessment ? (
                      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center space-y-4">
                        <div className="bg-blue-600/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                          <BrainCircuit className="w-8 h-8 text-blue-400" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-white font-bold">Avaliação de Conhecimento</h4>
                          <p className="text-sm text-slate-400">
                            Para liberar o envio do seu relatório, você precisa passar em todos os níveis (Iniciante, Intermediário e Especialista) de cada material de estudo.
                          </p>
                          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 mt-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                              <span className="text-slate-500">Progresso Geral</span>
                              <span className="text-blue-400">{stats.completed} / {stats.total}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full transition-all duration-500"
                                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowAssessment(true)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                        >
                          Iniciar Avaliação IA
                        </button>
                      </div>
                    ) : !isAssessmentPassed && showAssessment ? (
                      <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
                        <AssessmentChat 
                          node={node} 
                          onComplete={(passed) => {
                            fetchAssessmentResult();
                            if (passed) {
                              setShowAssessment(false);
                            }
                          }} 
                        />
                      </div>
                    ) : (
                      <>
                        {existingReport?.teacher_feedback && (
                          <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase">
                              <MessageSquare className="w-4 h-4" /> Feedback do Instrutor
                            </div>
                            <p className="text-sm text-slate-300 italic">"{existingReport.teacher_feedback}"</p>
                          </div>
                        )}

                        <div className="space-y-4">
                          <textarea
                            value={report}
                            onChange={(e) => setReport(e.target.value)}
                            disabled={existingReport?.status === 'approved' || submitting}
                            placeholder="O que você aprendeu neste módulo? Descreva os conceitos principais..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-40 resize-none disabled:opacity-50"
                          />

                          {/* Attachments */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Anexos ({attachments.length})</span>
                              {existingReport?.status !== 'approved' && (
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={uploading}
                                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 uppercase"
                                >
                                  <Paperclip className="w-3 h-3" /> {uploading ? 'Subindo...' : 'Anexar Documento'}
                                </button>
                              )}
                              <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                className="hidden" 
                                multiple
                              />
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {attachments.map((url, idx) => (
                                <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex items-center gap-2 group/file">
                                  <FileText className="w-4 h-4 text-slate-400" />
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-300 hover:text-blue-400 truncate max-w-[100px]">
                                    Arquivo {idx + 1}
                                  </a>
                                  {existingReport?.status !== 'approved' && (
                                    <button onClick={() => removeAttachment(idx)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                              {existingReport?.status === 'pending' && (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-md">
                                  <AlertCircle className="w-3 h-3" /> Aguardando Avaliação
                                </span>
                              )}
                              {existingReport?.status === 'approved' && (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-md">
                                  <Check className="w-3 h-3" /> Aprovado
                                </span>
                              )}
                              {existingReport?.status === 'rejected' && (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md">
                                  <X className="w-3 h-3" /> Revisão Necessária
                                </span>
                              )}
                            </div>

                            {existingReport?.status !== 'approved' && (
                              <button
                                onClick={handleSubmitReport}
                                disabled={submitting || !report.trim() || uploading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                              >
                                {submitting ? 'Enviando...' : (
                                  <>
                                    <Send className="w-4 h-4" /> {existingReport ? 'Reenviar para Avaliação' : 'Enviar Relatório'}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {!showAssessment && (
                <div className="mt-8 pt-6 border-t border-slate-800">
                  {isAdmin ? (
                    <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 text-center">
                      <p className="text-blue-400 text-sm font-bold uppercase tracking-widest">
                        Modo de Visualização do Instrutor
                      </p>
                      <p className="text-slate-500 text-[10px] mt-1">
                        Você tem acesso total aos materiais sem necessidade de relatórios.
                      </p>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => onComplete(node.id)}
                        disabled={!canComplete}
                        className={`w-full font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg transform hover:-translate-y-0.5 ${
                          canComplete 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {node.status === NodeStatus.Completed ? 'Módulo Concluído' : (
                          canComplete ? 'Concluir Módulo' : 'Aguardando Aprovação do Relatório'
                        )}
                      </button>
                      {!canComplete && (
                        <p className="text-center text-[10px] text-slate-500 mt-3 uppercase tracking-widest font-bold">
                          Você precisa enviar o relatório e ser aprovado para prosseguir
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
