/**
 * HorizontalMap.tsx - Componente que renderiza a trilha de aprendizado em formato horizontal.
 * Gerencia a lógica de desbloqueio de módulos, progresso do usuário e navegação por scroll.
 */
import { useState, useEffect, useRef } from 'react';
import { studyNodes as initialNodes } from '../data/mock';
import { StudyNode, NodeStatus } from '../types';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import { ChevronLeft, ChevronRight, Database } from 'lucide-react';
import MapNode from './MapNode';
import ModuleModal from './ModuleModal';
import toast from 'react-hot-toast';

interface HorizontalMapProps {
  onProgressUpdate?: (completed: number, total: number) => void;
  isAdmin?: boolean;
  onGoToAdmin?: () => void;
}

export default function HorizontalMap({ onProgressUpdate, isAdmin, onGoToAdmin }: HorizontalMapProps) {
  const [nodes, setNodes] = useState<StudyNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<StudyNode | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ref para evitar condições de corrida em chamadas assíncronas
  const lastCallId = useRef(0);

  /**
   * Busca o progresso do usuário e os módulos do banco de dados.
   * Define o status de cada módulo (Bloqueado, Atual, Concluído).
   * @param currentIsAdmin Indica se o usuário atual tem privilégios de admin
   */
  async function fetchUserProgress(currentIsAdmin: boolean) {
    const callId = ++lastCallId.current;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca todos os módulos (nodes) cadastrados no banco
      const dbNodes = await api.getNodes();
      
      // Se uma nova chamada foi iniciada, descarta o resultado desta
      if (callId !== lastCallId.current) return;

      // 2. Busca o progresso e relatórios do usuário (apenas se não for admin)
      let reportsMap = new Map();
      let progressNodeIds = new Set();

      if (!currentIsAdmin) {
        const [progressData, reportsData] = await Promise.all([
          api.getProgress(user.id),
          api.getReports(user.id)
        ]);

        if (callId !== lastCallId.current) return;

        // Mapeia os status para facilitar a consulta durante a renderização
        reportsMap = new Map(reportsData?.map((r: any) => [r.node_id, r.status]));
        progressNodeIds = new Set(progressData?.filter((p: any) => p.completed).map((p: any) => p.node_id) || []);
      }
      
      let foundCurrent = false;

      // 3. Processa os módulos para definir o status visual de cada um
      const nodesToDisplay = (dbNodes || [])
        .filter(node => node.order_index !== 9) // Exclui o Módulo 10 da trilha principal
        .map(node => {
        const newNode = { ...node };

        // Administradores veem tudo desbloqueado por padrão
        if (currentIsAdmin) {
          newNode.status = NodeStatus.Completed;
          return newNode;
        }

        const reportStatus = reportsMap.get(node.id);
        const isLegacyCompleted = progressNodeIds.has(node.id) && !reportStatus;
        const isApproved = reportStatus === 'approved';

        // Lógica de desbloqueio sequencial
        if (isApproved || isLegacyCompleted) {
          newNode.status = NodeStatus.Completed;
        } else if (!foundCurrent) {
          // O primeiro módulo não concluído torna-se o "Módulo Atual"
          newNode.status = NodeStatus.Current;
          foundCurrent = true;
        } else {
          // Todos os módulos após o atual ficam bloqueados
          newNode.status = NodeStatus.Locked;
        }
        return newNode;
      });

      // Atualiza o estado apenas se esta for a chamada mais recente
      if (callId === lastCallId.current) {
        setNodes(nodesToDisplay);
        
        // Notifica o componente pai sobre o progresso total
        const completedCount = nodesToDisplay.filter(n => n.status === NodeStatus.Completed).length;
        if (onProgressUpdate) {
          onProgressUpdate(completedCount, nodesToDisplay.length);
        }
      }
    } catch (error: any) {
      if (callId === lastCallId.current) {
        console.error('Erro ao buscar progresso:', error.message);
      }
    } finally {
      if (callId === lastCallId.current) {
        setLoading(false);
      }
    }
  }

  // Recarrega o mapa sempre que o papel do usuário mudar
  useEffect(() => {
    fetchUserProgress(!!isAdmin);
  }, [isAdmin]);

  /**
   * Realiza o scroll horizontal suave do container.
   * @param direction Direção do scroll ('left' ou 'right')
   */
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  /**
   * Abre o modal de detalhes ao clicar em um módulo desbloqueado.
   */
  const handleNodeClick = (node: StudyNode) => {
    if (node.status !== NodeStatus.Locked) {
      setSelectedNode(node);
    }
  };

  const handleCloseModal = () => {
    setSelectedNode(null);
  };

  /**
   * Marca um módulo como concluído no banco de dados.
   * @param nodeId ID do módulo a ser concluído
   */
  const handleCompleteNode = async (nodeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nenhum usuário logado');

      await api.saveProgress({
        user_id: user.id,
        node_id: nodeId,
        completed: true,
      });

      // Atualiza o mapa para refletir a mudança
      await fetchUserProgress(!!isAdmin);
    } catch (error: any) {
      console.error('Erro ao completar o nó:', error.message);
      toast.error('Não foi possível salvar seu progresso. Tente novamente.');
    } finally {
      setSelectedNode(null);
    }
  };

  /**
   * Insere dados iniciais (mock) no banco de dados para popular a trilha.
   */
  const handleSeedData = async () => {
    try {
      setLoading(true);
      const { studyNodes: initialNodes } = await import('../data/mock');
      const nodesToInsert = initialNodes.map(({ id, status, ...rest }) => ({
        ...rest,
        links: rest.links || []
      }));

      for (const node of nodesToInsert) {
        await api.createNode(node);
      }
      
      await fetchUserProgress(!!isAdmin);
    } catch (err: any) {
      console.error('Erro ao semear dados:', err);
      toast.error('Erro ao semear dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Renderização do estado de carregamento
  if (loading) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Carregando sua jornada...</p>
      </div>
    );
  }

  // Renderização caso não existam módulos cadastrados
  if (nodes.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-center">
        <div className="bg-white p-3 rounded-2xl mb-4 shadow-lg">
          <img 
            src="https://techify.one/logo-techify.png" 
            alt="Techify Logo" 
            className="w-12 h-12 object-contain grayscale opacity-50"
            referrerPolicy="no-referrer"
          />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Nenhum módulo encontrado</h3>
        <p className="text-slate-400 max-w-md mb-6">
          Parece que a trilha ainda não foi configurada.
        </p>
        {isAdmin ? (
          <div className="flex gap-4">
            <button 
              onClick={handleSeedData}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-8 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              <Database className="w-5 h-5" />
              Popular com Dados Iniciais
            </button>
            <button 
              onClick={onGoToAdmin}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-8 rounded-xl transition-all border border-slate-700"
            >
              Ir para Painel Admin
            </button>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Aguarde o instrutor configurar os módulos.</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Botões de Navegação (Scroll) - Escondidos em telas muito pequenas onde o touch é melhor */}
      <button 
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 md:-translate-x-4 z-20 p-2 md:p-3 bg-slate-900 border border-slate-700 rounded-full text-blue-400 hover:text-white hover:bg-blue-600 transition-all shadow-xl opacity-0 md:group-hover:opacity-100 hidden sm:block"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      <button 
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 md:translate-x-4 z-20 p-2 md:p-3 bg-slate-900 border border-slate-700 rounded-full text-blue-400 hover:text-white hover:bg-blue-600 transition-all shadow-xl opacity-0 md:group-hover:opacity-100 hidden sm:block"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Container da Trilha */}
      <div className="relative w-full flex items-center h-48 md:h-64">
        {/* Linha conectora de fundo */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800/50 rounded-full" />
        
        <div 
          ref={scrollContainerRef}
          className="w-full overflow-x-auto custom-scrollbar py-8 md:py-12 scroll-smooth"
        >
          <div className="inline-flex items-center space-x-12 md:space-x-24 px-10 md:px-20">
            {/* Renderiza cada nó do mapa */}
            {nodes.map((node) => (
              <MapNode key={node.id} node={node} onNodeClick={handleNodeClick} />
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Módulo */}
      <ModuleModal 
        node={selectedNode} 
        onClose={handleCloseModal} 
        onComplete={handleCompleteNode} 
        isAdmin={isAdmin}
      />
    </div>
  );
}
