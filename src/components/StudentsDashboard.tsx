import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { LearningReport, StudyNode, UserRole } from '../types';
import { Users, CheckCircle2, Clock, MessageSquare, Check, X, Search, ChevronRight, GraduationCap, Paperclip, FileText, Star, BrainCircuit, Trophy, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudentProgress {
  user_id: string;
  email: string;
  completed_count: number;
  total_count: number;
  last_activity?: string;
  has_pending_report?: boolean;
  avatar_url?: string;
}

export default function StudentsDashboard() {
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [reports, setReports] = useState<(LearningReport & { user_email: string, node_title: string })[]>([]);
  const [allNodes, setAllNodes] = useState<StudyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [processingReport, setProcessingReport] = useState<string | null>(null);
  const [studentAssessments, setStudentAssessments] = useState<any[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isHistoryMinimized, setIsHistoryMinimized] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Helper functions moved up to avoid hoisting issues
  const getCurrentModuleNode = (studentId: string) => {
    if (!studentId || allNodes.length === 0) return allNodes[0];
    
    const studentReports = reports.filter(r => r.user_id === studentId);
    const approvedNodeIds = studentReports
      .filter(r => r.status === 'approved')
      .map(r => r.node_id);
    
    const current = allNodes.find(node => {
      const isApproved = approvedNodeIds.includes(node.id);
      const hasReport = studentReports.some(r => r.node_id === node.id);
      return !isApproved && hasReport; 
    }) || allNodes.find(node => {
      const isApproved = approvedNodeIds.includes(node.id);
      const hasReport = studentReports.some(r => r.node_id === node.id);
      return !isApproved && !hasReport;
    });

    return current;
  };

  const getCurrentModule = (studentId: string) => {
    const current = getCurrentModuleNode(studentId);
    return current ? current.title : 'Trilha Concluída';
  };

  const otherNodes = React.useMemo(() => {
    if (!selectedStudentId) return allNodes;
    // We now show all nodes in the queue, but we can highlight the current one or just show all
    return allNodes;
  }, [allNodes, selectedStudentId, reports]);

  const scrollModules = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      setActiveQueueIndex(prev => Math.max(0, prev - 1));
    } else {
      setActiveQueueIndex(prev => Math.min(otherNodes.length - 1, prev + 1));
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      const itemHeight = 160; // Altura aproximada de cada item na fila
      scrollRef.current.scrollTo({ top: activeQueueIndex * itemHeight, behavior: 'smooth' });
    }
  }, [activeQueueIndex]);

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentAssessments(selectedStudentId);
    } else {
      setStudentAssessments([]);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    // When a student is selected, set the active index to their current module
    if (selectedStudentId && allNodes.length > 0) {
      const currentNode = getCurrentModuleNode(selectedStudentId);
      if (currentNode) {
        const index = allNodes.findIndex(n => n.id === currentNode.id);
        if (index !== -1) {
          setActiveQueueIndex(index);
        }
      }
    }
  }, [selectedStudentId, allNodes, reports]);

  async function fetchStudentAssessments(userId: string) {
    setLoadingAssessments(true);
    try {
      // Fetch all assessments for the student, not just the current module
      const data = await api.getTestResults(userId);
      if (Array.isArray(data)) {
        setStudentAssessments(data);
      }
    } catch (error) {
      console.error('Error fetching student assessments:', error);
    } finally {
      setLoadingAssessments(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Buscar todos os módulos (nodes)
      const nodes = await api.getNodes();
      setAllNodes(nodes || []);
      const totalNodes = (nodes || []).length;

      // 2. Buscar todos os relatórios para processar progresso e status
      const reportsData = await api.adminGetReports();

      // 3. Buscar papéis de estudantes
      const rolesData = await api.adminGetStudents();

      // 4. Buscar perfis para obter os nomes sociais
      const profilesData = await api.adminGetProfiles();

      const profileMap = new Map(Array.isArray(profilesData) ? profilesData.map((p: any) => [p.user_id, { name: p.full_name, avatar: p.avatar_url }]) : []);

      // 5. Mapear estudantes
      const studentMap = new Map<string, StudentProgress>();
      const pendingReportUserIds = new Set(
        Array.isArray(reportsData) 
          ? reportsData.filter((r: any) => r.status === 'pending').map((r: any) => r.user_id)
          : []
      );
      
      if (Array.isArray(rolesData)) {
        rolesData.forEach((student: any) => {
          const profile = profileMap.get(student.user_id);
          // Usa o nome do perfil se disponível, senão usa o email, senão um fallback
          const studentName = profile?.name || student.email || `Aluno ${student.user_id.slice(0, 8)}`;
          
          studentMap.set(student.user_id, {
            user_id: student.user_id,
            email: studentName,
            completed_count: parseInt(student.completed_count),
            total_count: totalNodes,
            has_pending_report: pendingReportUserIds.has(student.user_id),
            avatar_url: profile?.avatar
          });
        });
      }

      setStudents(Array.from(studentMap.values()));
      setReports(Array.isArray(reportsData) ? reportsData.map((r: any) => ({
        ...r,
        user_email: profileMap.get(r.user_id)?.name || `Aluno ${r.user_id.slice(0, 8)}`,
        node_title: nodes.find((n: any) => n.id === r.node_id)?.title || 'Módulo Desconhecido'
      })) : []);

    } catch (error) {
      console.error('Error fetching students data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleReviewReport = async (reportId: string, status: 'approved' | 'rejected') => {
    setProcessingReport(reportId);
    try {
      await api.adminReviewReport(reportId, status, feedback);

      setFeedback('');
      toast.success(status === 'approved' ? 'Relatório aprovado!' : 'Revisão solicitada.');
      await fetchData();
    } catch (error: any) {
      toast.error('Erro ao avaliar relatório: ' + error.message);
    } finally {
      setProcessingReport(null);
    }
  };

  const selectedStudent = students.find(s => s.user_id === selectedStudentId);
  const studentReports = reports.filter(r => r.user_id === selectedStudentId);
  
  if (loading) return <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando dados dos alunos...</div>;

  return (
    <div className="space-y-10 pb-20">
      <AnimatePresence mode="wait">
        {!selectedStudentId ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tighter">
                  <Users className="w-8 h-8 text-blue-500" /> GESTÃO DE ALUNOS
                </h2>
                <p className="text-slate-500 text-sm mt-1 font-medium uppercase tracking-widest">Acompanhe o desempenho individual da sua turma.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => (
                <button
                  key={student.user_id}
                  onClick={() => setSelectedStudentId(student.user_id)}
                  className="group bg-slate-900 border border-slate-800 p-6 rounded-3xl hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10 text-left relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <GraduationCap className="w-16 h-16 text-blue-500" />
                  </div>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/20 relative overflow-hidden">
                      {student.avatar_url ? (
                        <img 
                          src={student.avatar_url} 
                          alt={student.email} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <Users className="w-6 h-6 text-blue-400" />
                      )}
                      {student.has_pending_report && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse" title="Relatório Pendente" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-black tracking-tight flex items-center gap-2">
                        {student.email}
                        {student.has_pending_report && (
                          <span className="bg-red-500/10 text-red-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-widest">Ação Necessária</span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Estudante Ativo</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progresso Geral</span>
                      <span className="text-lg font-black text-blue-400">
                        {Math.round((student.completed_count / student.total_count) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-1000 ease-out"
                        style={{ width: `${(student.completed_count / student.total_count) * 100}%` }}
                      />
                    </div>
                    
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">
                          {getCurrentModule(student.user_id)}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {students.length === 0 && (
              <div className="text-center py-32 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Nenhum aluno encontrado</h3>
                <p className="text-slate-500 max-w-xs mx-auto text-sm">
                  Parece que ainda não há estudantes cadastrados ou ativos na plataforma. 
                  Os alunos aparecerão aqui assim que começarem a interagir com os módulos.
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <button 
              onClick={() => setSelectedStudentId(null)}
              className="flex items-center gap-2 text-slate-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors mb-4"
            >
              <X className="w-4 h-4" /> Voltar para Lista
            </button>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/20 shrink-0 overflow-hidden">
                {selectedStudent?.avatar_url ? (
                  <img 
                    src={selectedStudent.avatar_url} 
                    alt={selectedStudent.email}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Users className="w-10 h-10 md:w-12 md:h-12 text-white" />
                )}
              </div>
              <div className="flex-1 text-center md:text-left w-full">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter break-words">{selectedStudent?.email}</h2>
                  <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest self-center md:self-auto">
                    Perfil do Estudante
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Módulo Atual</p>
                    <p className="text-white font-bold truncate text-sm md:text-base">{getCurrentModule(selectedStudentId)}</p>
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Concluídos</p>
                    <p className="text-white font-bold text-sm md:text-base">{selectedStudent?.completed_count} de {selectedStudent?.total_count}</p>
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Relatórios</p>
                    <p className="text-white font-bold text-sm md:text-base">{studentReports.length} enviados</p>
                  </div>
                </div>

                {/* Card de Desempenho Geral */}
                {studentAssessments.length > 0 && (
                  <div className="mt-6 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 p-6 rounded-3xl shadow-xl shadow-blue-900/10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-600 rounded-xl">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Desempenho Geral em Avaliações</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Média de Sucesso</p>
                        <p className="text-xl font-black text-blue-400">
                          {studentAssessments.length > 0 
                            ? Math.round(studentAssessments.reduce((acc, a) => acc + (Number(a.score) || 0), 0) / studentAssessments.length)
                            : 0}%
                        </p>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Taxa de Aprovação</p>
                        <p className="text-xl font-black text-green-400">
                          {studentAssessments.length > 0 
                            ? Math.round((studentAssessments.filter(a => a.passed).length / studentAssessments.length) * 100)
                            : 0}%
                        </p>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total de Testes</p>
                        <p className="text-xl font-black text-white">{studentAssessments.length}</p>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Melhor Nota</p>
                        <p className="text-xl font-black text-yellow-400">
                          {studentAssessments.length > 0 
                            ? Math.max(...studentAssessments.map(a => Number(a.score) || 0))
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">
                  <button
                    onClick={async () => {
                      if (window.confirm(`Deseja promover ${selectedStudent?.email} a Instrutor?`)) {
                        try {
                          await api.saveUserRole(selectedStudentId!, 'admin', selectedStudent?.email);
                          toast.success('Usuário promovido a Instrutor!');
                          await fetchData();
                        } catch (err) {
                          toast.error('Erro ao promover usuário.');
                        }
                      }
                    }}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700 hover:border-blue-500"
                  >
                    <GraduationCap className="w-4 h-4" /> Promover a Instrutor
                  </button>
                  <button
                    onClick={async () => {
                      if (window.confirm(`ATENÇÃO: Deseja realmente deletar ${selectedStudent?.email}? Todos os dados (progresso, relatórios e avaliações) serão removidos permanentemente.`)) {
                        try {
                          await api.adminDeleteStudent(selectedStudentId!);
                          toast.success('Aluno deletado com sucesso.');
                          setSelectedStudentId(null);
                          await fetchData();
                        } catch (err) {
                          toast.error('Erro ao deletar aluno.');
                        }
                      }
                    }}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700 hover:border-red-500"
                  >
                    <Trash2 className="w-4 h-4" /> Deletar Aluno
                  </button>
                </div>
              </div>
            </div>

            {/* Detalhamento de Avaliações IA */}
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-blue-500" /> Progresso em Avaliações IA
                </h3>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" /> Módulo Atual
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                    <div className="w-2 h-2 rounded-full bg-slate-800" /> Outros Módulos
                  </span>
                </div>
              </div>
              
              {loadingAssessments ? (
                <div className="text-center py-10 text-slate-500 text-xs animate-pulse bg-slate-900/50 border border-slate-800 rounded-3xl">Carregando avaliações...</div>
              ) : (
                <div className="relative bg-slate-900 border border-slate-800 rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl min-h-[500px] md:min-h-[600px] flex flex-col md:flex-row">
                  
                  {/* Módulo Selecionado em Destaque (Principal) */}
                  <div className={`flex-1 p-6 md:p-10 relative overflow-hidden transition-all duration-500 ${isQueueOpen ? 'md:pr-80' : 'md:pr-10'}`}>
                    <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 pointer-events-none">
                      <BrainCircuit className="w-32 h-32 md:w-48 md:h-48 text-blue-500" />
                    </div>
                    
                    {allNodes.filter((_, idx) => idx === activeQueueIndex).map(node => {
                      const nodeResults = studentAssessments.filter(r => r.node_id === node.id && r.passed === true);
                      const levels = ['beginner', 'intermediate', 'expert'];
                      const totalRequired = node.links.length * levels.length;
                      const completedCount = node.links.reduce((acc, link) => {
                        return acc + levels.filter(level => 
                          nodeResults.some(r => r.link_url === link.url && r.difficulty === level)
                        ).length;
                      }, 0);

                      const isCurrentModule = getCurrentModuleNode(selectedStudentId!)?.id === node.id;

                      return (
                        <div key={node.id} className="relative z-10 h-full flex flex-col">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 md:mb-10">
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                                  isCurrentModule 
                                    ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' 
                                    : 'text-slate-400 bg-slate-800/50 border-slate-700/50'
                                }`}>
                                  {isCurrentModule ? 'Módulo Atual' : 'Histórico de Módulo'}
                                </span>
                                {isCurrentModule && (
                                  <div className="flex gap-1">
                                    {[1, 2, 3].map(i => (
                                      <div key={i} className="w-1 h-1 rounded-full bg-blue-500/30 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <h4 className="text-2xl md:text-4xl font-black text-white tracking-tighter leading-tight">{node.title}</h4>
                            </div>
                            <div className="flex gap-3 md:gap-4 w-full sm:w-auto">
                              <div className="bg-slate-950/50 border border-slate-800 p-3 md:p-4 rounded-2xl text-center flex-1 sm:min-w-[120px]">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status IA</p>
                                <span className={`text-lg md:text-xl font-black block ${
                                  completedCount >= totalRequired ? 'text-green-500' : 'text-blue-400'
                                }`}>
                                  {completedCount} <span className="text-slate-700 text-sm">/ {totalRequired}</span>
                                </span>
                              </div>
                              
                              {/* Botão para Abrir/Fechar Fila Lateral */}
                              <button 
                                onClick={() => setIsQueueOpen(!isQueueOpen)}
                                className={`p-3 md:p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 group ${
                                  isQueueOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-blue-500/50'
                                }`}
                              >
                                <div className="flex gap-0.5">
                                  <div className={`w-1 h-1 rounded-full ${isQueueOpen ? 'bg-white' : 'bg-blue-500'}`} />
                                  <div className={`w-1 h-1 rounded-full ${isQueueOpen ? 'bg-white' : 'bg-blue-500'}`} />
                                </div>
                                <p className="text-[8px] font-black uppercase tracking-widest">Fila</p>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 flex-1">
                            {node.links.map((link, lIdx) => (
                              <div key={lIdx} className="bg-slate-950/30 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-800/50 hover:border-blue-500/30 transition-all group/link">
                                <div className="flex items-center gap-2 mb-4">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                  <p className="text-[10px] md:text-xs text-slate-300 font-bold uppercase tracking-tight truncate">{link.title}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {levels.map((level) => {
                                    const result = nodeResults.find(r => r.link_url === link.url && r.difficulty === level);
                                    return (
                                      <div 
                                        key={level}
                                        className={`p-2 md:p-3 rounded-xl border text-center transition-all ${
                                          result 
                                            ? 'bg-green-500/5 border-green-500/20 text-green-500' 
                                            : 'bg-slate-900/50 border-slate-800/50 text-slate-700'
                                        }`}
                                      >
                                        <p className="text-[7px] font-black uppercase tracking-tighter mb-1 opacity-50">
                                          {level === 'beginner' ? 'Inic' : level === 'intermediate' ? 'Inter' : 'Espec'}
                                        </p>
                                        {result ? (
                                          <div className="flex items-center justify-center gap-0.5">
                                            <Star className="w-2.5 h-2.5 fill-current" />
                                            <span className="text-[10px] font-black">{result.score}%</span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] font-bold opacity-20">-</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fila Lateral Oculta (Drawer) */}
                  <div 
                    className={`fixed md:absolute inset-y-0 right-0 w-full md:w-80 bg-slate-950 border-l border-slate-800 shadow-2xl transition-transform duration-500 z-[60] md:z-40 flex flex-col ${
                      isQueueOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  >
                    <div className="p-6 md:p-8 border-b border-slate-800/50 flex justify-between items-center">
                      <div className="flex flex-col">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Fila de Módulos</h4>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => scrollModules('up')}
                            disabled={activeQueueIndex === 0}
                            className={`p-1.5 rounded-lg border transition-all ${
                              activeQueueIndex === 0 
                                ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed' 
                                : 'bg-blue-600 border-blue-500 text-white hover:scale-110 active:scale-95'
                            }`}
                          >
                            <ChevronRight className="w-4 h-4 -rotate-90" />
                          </button>
                          <button 
                            onClick={() => scrollModules('down')}
                            disabled={activeQueueIndex === otherNodes.length - 1}
                            className={`p-1.5 rounded-lg border transition-all ${
                              activeQueueIndex === otherNodes.length - 1 
                                ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed' 
                                : 'bg-blue-600 border-blue-500 text-white hover:scale-110 active:scale-95'
                            }`}
                          >
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </button>
                        </div>
                      </div>
                      <button onClick={() => setIsQueueOpen(false)} className="p-2 bg-slate-900 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Viewport da Fila */}
                    <div className="flex-1 relative overflow-hidden">
                      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-slate-950 via-transparent to-slate-950 opacity-80" />
                      
                      <div 
                        ref={scrollRef}
                        className="absolute inset-0 overflow-y-auto custom-scrollbar py-12 md:py-24 px-6 md:px-8 space-y-4 scroll-smooth"
                      >
                        {otherNodes.map((node, idx) => {
                          const nodeResults = studentAssessments.filter(r => r.node_id === node.id && r.passed === true);
                          const levels = ['beginner', 'intermediate', 'expert'];
                          const totalRequired = node.links.length * levels.length;
                          const completedCount = node.links.reduce((acc, link) => {
                            return acc + levels.filter(level => 
                              nodeResults.some(r => r.link_url === link.url && r.difficulty === level)
                            ).length;
                          }, 0);

                          const isActive = idx === activeQueueIndex;

                          return (
                            <button 
                              key={node.id} 
                              onClick={() => setActiveQueueIndex(idx)}
                              className={`w-full h-32 rounded-[2rem] md:rounded-[2.5rem] p-6 flex flex-col justify-center border transition-all duration-500 text-left ${
                                isActive 
                                  ? 'bg-slate-900 border-blue-500/50 scale-100 opacity-100 shadow-xl shadow-blue-500/10' 
                                  : 'bg-transparent border-transparent scale-90 opacity-20 hover:opacity-50'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <h5 className={`font-black text-[11px] uppercase tracking-tight truncate pr-2 ${isActive ? 'text-white' : 'text-slate-500'}`}>
                                  {node.title}
                                </h5>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                                  completedCount >= totalRequired ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {completedCount}/{totalRequired}
                                </span>
                              </div>
                              
                              <div className="flex gap-1.5">
                                {node.links.map((_, lIdx) => (
                                  <div key={lIdx} className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-500 transition-all duration-1000" 
                                      style={{ width: isActive ? `${(completedCount / totalRequired) * 100}%` : '0%' }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-6 md:p-8 border-t border-slate-800/50 bg-slate-950/80">
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                          {activeQueueIndex + 1} / {otherNodes.length}
                        </p>
                        <div className="flex gap-1">
                          {otherNodes.map((_, i) => (
                            <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === activeQueueIndex ? 'bg-blue-500 w-3' : 'bg-slate-800'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-blue-500" /> Histórico Completo de Avaliações
                </h3>
                <button 
                  onClick={() => setIsHistoryMinimized(!isHistoryMinimized)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all border border-slate-700"
                >
                  {isHistoryMinimized ? (
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest">Expandir</span>
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest">Minimizar</span>
                      <ChevronRight className="w-4 h-4 -rotate-90" />
                    </div>
                  )}
                </button>
              </div>
              
              <AnimatePresence>
                {!isHistoryMinimized && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800/50 border-b border-slate-800">
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Módulo</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Conteúdo</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dificuldade</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Nota</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {studentAssessments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((assessment, idx) => {
                            const node = allNodes.find(n => n.id === assessment.node_id);
                            const link = node?.links.find(l => l.url === assessment.link_url);
                            
                            return (
                              <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                <td className="p-4">
                                  <span className="text-xs font-bold text-white">{node?.title || 'Módulo Removido'}</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px] block">
                                    {link?.title || assessment.link_url}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                                    assessment.difficulty === 'expert' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                    assessment.difficulty === 'intermediate' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                  }`}>
                                    {assessment.difficulty}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`text-sm font-black ${assessment.score >= 70 ? 'text-green-400' : 'text-red-400'}`}>
                                    {assessment.score}%
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  {assessment.passed ? (
                                    <div className="flex items-center justify-center gap-1 text-green-500">
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span className="text-[9px] font-black uppercase">Aprovado</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1 text-red-500">
                                      <X className="w-4 h-4" />
                                      <span className="text-[9px] font-black uppercase">Falhou</span>
                                    </div>
                                  )}
                                </td>
                                <td className="p-4">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {new Date(assessment.created_at).toLocaleDateString()}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {studentAssessments.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                                Nenhuma avaliação realizada ainda.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" /> Histórico de Relatórios
              </h3>
              
              <div className="grid gap-6">
                {studentReports.map((report) => (
                  <div key={report.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                    <div className="p-6 bg-slate-800/30 border-b border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">
                          {report.node_title}
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">
                          Enviado por {report.user_email} em {new Date(report.updated_at || report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border ${
                        report.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        report.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {report.status === 'pending' ? 'Aguardando' : 
                         report.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                      </span>
                    </div>
                    
                    <div className="p-8 space-y-8">
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">O que o aluno aprendeu:</span>
                        <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 text-slate-300 text-sm leading-relaxed italic">
                          "{report.content}"
                        </div>
                      </div>

                      {report.attachments && report.attachments.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Paperclip className="w-3 h-3" /> Documentos Anexados ({report.attachments.length})
                          </span>
                          <div className="flex flex-wrap gap-3">
                            {report.attachments.map((url, idx) => (
                              <a 
                                key={idx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-blue-500 hover:bg-blue-500/5 transition-all group"
                              >
                                <FileText className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                                <span className="text-xs font-bold text-slate-300 group-hover:text-blue-400">Ver Arquivo {idx + 1}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.status === 'pending' ? (
                        <div className="space-y-4 pt-6 border-t border-slate-800">
                          <div className="space-y-3">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sua Avaliação</span>
                            <textarea
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                              placeholder="Escreva seu feedback para o aluno..."
                              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-28 resize-none"
                            />
                          </div>
                          <div className="flex gap-4">
                            <button
                              onClick={() => handleReviewReport(report.id, 'approved')}
                              disabled={!!processingReport}
                              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 uppercase text-xs tracking-widest"
                            >
                              <Check className="w-4 h-4" /> Aprovar Relatório
                            </button>
                            <button
                              onClick={() => handleReviewReport(report.id, 'rejected')}
                              disabled={!!processingReport}
                              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 uppercase text-xs tracking-widest"
                            >
                              <X className="w-4 h-4" /> Solicitar Revisão
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-950/30 p-6 rounded-2xl border border-slate-800/50 space-y-2">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seu Feedback Enviado:</span>
                          <p className="text-sm text-slate-400 italic">
                            {report.teacher_feedback || "Sem comentários adicionais."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {studentReports.length === 0 && (
                  <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-3xl">
                    <Clock className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum relatório enviado por este aluno.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
