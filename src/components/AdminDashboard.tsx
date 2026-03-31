/**
 * AdminDashboard.tsx - Painel de Controle do Instrutor.
 * Permite criar, editar, excluir e ordenar os módulos da trilha de estudos.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import { StudyNode, StudyLink } from '../types';
import { studyNodes as initialNodes } from '../data/mock';
import { Plus, Trash2, Edit2, Save, X, Link as LinkIcon, MoveUp, MoveDown, Database, CheckCircle, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  // Estados para gerenciar a lista de módulos, edição e mensagens de feedback
  const [nodes, setNodes] = useState<StudyNode[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [editingNode, setEditingNode] = useState<Partial<StudyNode> | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Carrega os módulos ao montar o componente
  useEffect(() => {
    fetchNodes();
  }, []);

  /**
   * Busca todos os módulos cadastrados no banco de dados.
   */
  async function fetchNodes() {
    setLoading(true);
    try {
      const data = await api.getNodes();
      setNodes(data || []);
    } catch (error: any) {
      console.error('Error fetching nodes:', error);
      toast.error('Erro ao carregar módulos: ' + error.message);
    }
    setLoading(false);
  }

  /**
   * Insere dados iniciais (mock) no banco de dados para popular a trilha.
   */
  const handleSeedData = async () => {
    try {
      setLoading(true);
      const nodesToInsert = initialNodes.map(({ id, status, ...rest }) => ({
        ...rest,
        links: rest.links || []
      }));

      for (const node of nodesToInsert) {
        await api.createNode(node);
      }
      
      toast.success('Dados semeados com sucesso!');
      setSeedConfirm(false);
      await fetchNodes();
    } catch (err: any) {
      toast.error('Erro inesperado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Salva as alterações de um módulo (Criação ou Edição).
   */
  const handleSaveNode = async () => {
    if (!editingNode?.title) return;

    try {
      const nodeToSave = {
        title: editingNode.title,
        description: editingNode.description || '',
        links: editingNode.links || [],
        order_index: editingNode.order_index ?? nodes.length,
      };

      if (editingNode.id) {
        // Atualiza módulo existente
        await api.updateNode(editingNode.id, nodeToSave);
      } else {
        // Cria novo módulo
        await api.createNode(nodeToSave);
      }

      toast.success('Módulo salvo com sucesso!');
      setEditingNode(null);
      await fetchNodes();
    } catch (err: any) {
      toast.error('Erro inesperado ao salvar: ' + err.message);
    }
  };

  /**
   * Exclui um módulo permanentemente.
   */
  const handleDeleteNode = async (id: string) => {
    try {
      await api.deleteNode(id);
      toast.success('Módulo excluído!');
      setDeleteConfirm(null);
      setSelectedNodes(prev => prev.filter(nodeId => nodeId !== id));
      await fetchNodes();
    } catch (err: any) {
      toast.error('Erro inesperado ao excluir: ' + err.message);
    }
  };

  /**
   * Exclui múltiplos módulos selecionados.
   */
  const handleBulkDelete = async () => {
    if (selectedNodes.length === 0) return;
    try {
      setLoading(true);
      await api.bulkDeleteNodes(selectedNodes);
      toast.success(`${selectedNodes.length} módulos excluídos!`);
      setSelectedNodes([]);
      setBulkDeleteConfirm(false);
      await fetchNodes();
    } catch (err: any) {
      toast.error('Erro ao excluir módulos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const libraryNode = nodes.find(n => n.order_index === 9);
  const mainNodesList = nodes.filter(n => n.id !== libraryNode?.id);

  /**
   * Altera a ordem de um módulo.
   */
  const handleMoveNode = async (index: number, direction: 'up' | 'down') => {
    const newMainNodes = [...mainNodesList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newMainNodes.length) return;
    
    // Swap
    const temp = newMainNodes[index];
    newMainNodes[index] = newMainNodes[targetIndex];
    newMainNodes[targetIndex] = temp;
    
    // Update order_index
    const updatedNodes = newMainNodes.map((node, i) => ({
      ...node,
      order_index: i
    }));
    
    setNodes(libraryNode ? [libraryNode, ...updatedNodes] : updatedNodes);
    
    try {
      setReordering(true);
      await api.reorderNodes(updatedNodes.map(n => ({ id: n.id, order_index: n.order_index })));
      toast.success('Ordem atualizada!');
    } catch (err: any) {
      toast.error('Erro ao reordenar: ' + err.message);
      await fetchNodes(); // Revert on error
    } finally {
      setReordering(false);
    }
  };

  const toggleSelectNode = (id: string) => {
    setSelectedNodes(prev => 
      prev.includes(id) ? prev.filter(nodeId => nodeId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const mainNodeIds = mainNodesList.map(n => n.id);
    if (selectedNodes.length === mainNodeIds.length) {
      setSelectedNodes([]);
    } else {
      setSelectedNodes(mainNodeIds);
    }
  };

  // Funções auxiliares para gerenciar a lista de links dentro do módulo sendo editado
  const addLink = () => {
    const newLinks = [...(editingNode?.links || []), { type: 'reference', title: '', url: '' } as StudyLink];
    setEditingNode({ ...editingNode, links: newLinks });
  };

  const updateLink = (index: number, field: keyof StudyLink, value: string) => {
    const newLinks = [...(editingNode?.links || [])];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setEditingNode({ ...editingNode, links: newLinks });
  };

  const removeLink = (index: number) => {
    const newLinks = (editingNode?.links || []).filter((_, i) => i !== index);
    setEditingNode({ ...editingNode, links: newLinks });
  };

  if (loading) return <div className="text-center py-20 text-slate-400">Carregando painel...</div>;

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase">Gerenciar Módulos</h2>
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Configure a trilha e a biblioteca de cursos.</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
          {/* Botão de Excluir em Massa */}
          {selectedNodes.length > 0 && (
            <div className="flex items-center gap-2">
              {bulkDeleteConfirm ? (
                <div className="flex items-center gap-2 bg-red-900/20 p-1 rounded-lg border border-red-500/30">
                  <span className="text-[10px] text-red-400 px-2 font-bold uppercase">Excluir {selectedNodes.length}?</span>
                  <button onClick={handleBulkDelete} className="bg-red-600 text-white text-[10px] px-3 py-1.5 rounded-md font-bold">Sim</button>
                  <button onClick={() => setBulkDeleteConfirm(false)} className="text-slate-400 text-[10px] px-3 py-1.5 hover:text-white">Não</button>
                </div>
              ) : (
                <button 
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white px-3 md:px-4 py-2 rounded-lg transition-all border border-red-500/20 font-bold text-xs"
                >
                  <Trash2 className="w-4 h-4" /> Excluir ({selectedNodes.length})
                </button>
              )}
            </div>
          )}

          {/* Botão de Seed (Semear dados iniciais) */}
          {seedConfirm ? (
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 flex-1 sm:flex-none justify-center">
              <span className="text-[10px] text-slate-400 px-2">Seed?</span>
              <button onClick={handleSeedData} className="bg-blue-600 text-white text-[10px] px-3 py-1.5 rounded-md font-bold">Sim</button>
              <button onClick={() => setSeedConfirm(false)} className="text-slate-400 text-[10px] px-3 py-1.5 hover:text-white">Não</button>
            </div>
          ) : (
            <button 
              onClick={() => setSeedConfirm(true)}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 md:px-4 py-2 rounded-lg transition-all border border-slate-700 flex-1 sm:flex-none text-xs"
            >
              <Database className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Semear Dados</span><span className="sm:hidden">Seed</span>
            </button>
          )}
          {/* Botão para criar novo módulo */}
          <button 
            onClick={() => setEditingNode({ title: '', description: '', links: [], order_index: nodes.length })}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 md:px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20 font-bold flex-1 sm:flex-none text-xs"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Novo Módulo</span><span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>


      {/* Lista de Módulos Cadastrados */}
      <div className="grid gap-4">
        {/* Renderizar Biblioteca Primeiro */}
        {libraryNode && (
          <div key={libraryNode.id} className="bg-blue-500/5 border border-blue-500/50 p-4 md:p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group transition-all">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-white text-base md:text-lg tracking-tight uppercase">Biblioteca Geral</h3>
                  <span className="bg-blue-500 text-white text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Ativo</span>
                </div>
                <p className="text-xs md:text-sm text-slate-400 font-medium line-clamp-2">{libraryNode.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setEditingNode(libraryNode)}
                className="flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-2 rounded-xl transition-all border border-blue-500/20 font-bold text-xs md:text-sm w-full sm:w-auto"
              >
                <Edit2 className="w-4 h-4" /> Gerenciar Biblioteca
              </button>
            </div>
          </div>
        )}

        <div className="h-px bg-slate-800 my-2" />
        <div className="flex justify-between items-center px-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trilha de Aprendizado Principal</h3>
          {mainNodesList.length > 0 && (
            <button 
              onClick={toggleSelectAll}
              className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
            >
              {selectedNodes.length === mainNodesList.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          )}
        </div>

        {mainNodesList.map((node, index, filteredArray) => {
          const isSelected = selectedNodes.includes(node.id);
          return (
            <div key={node.id} className={`bg-slate-900 border ${isSelected ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800'} p-4 rounded-xl flex items-center justify-between group transition-all`}>
              <div className="flex items-center gap-4">
                {/* Checkbox de Seleção */}
                <button 
                  onClick={() => toggleSelectNode(node.id)}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                </button>

                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold bg-slate-800 text-blue-400">
                  {node.order_index === 9 ? 'LIB' : node.order_index + 1}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100">{node.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-1">{node.description}</p>
                </div>
              </div>
              {/* Ações do Módulo (Editar/Excluir/Reordenar) */}
              <div className="flex items-center gap-2">
                {deleteConfirm === node.id ? (
                  <div className="flex items-center gap-2 bg-red-900/20 p-1 rounded-lg border border-red-500/30">
                    <button onClick={() => handleDeleteNode(node.id)} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-md font-bold">Excluir</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-slate-400 text-xs px-3 py-1.5 hover:text-white">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Botões de Reordenação */}
                    <div className="flex flex-col sm:flex-row gap-1 mr-2">
                      <button 
                        disabled={index === 0 || reordering}
                        onClick={() => handleMoveNode(index, 'up')}
                        className={`p-1.5 rounded-md transition-all ${index === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-400/10'}`}
                        title="Mover para cima"
                      >
                        <MoveUp className="w-4 h-4" />
                      </button>
                      <button 
                        disabled={index === filteredArray.length - 1 || reordering}
                        onClick={() => handleMoveNode(index, 'down')}
                        className={`p-1.5 rounded-md transition-all ${index === filteredArray.length - 1 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-400/10'}`}
                        title="Mover para baixo"
                      >
                        <MoveDown className="w-4 h-4" />
                      </button>
                    </div>

                    <button 
                      onClick={() => setEditingNode(node)}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                      title="Editar Módulo"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm(node.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Excluir Módulo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Edição/Criação de Módulo */}
      {editingNode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {editingNode.order_index === 9 ? 'Gerenciar Biblioteca' : editingNode.id ? 'Editar Módulo' : 'Novo Módulo'}
              </h3>
              <button onClick={() => setEditingNode(null)} className="text-slate-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              {/* Campos Básicos */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    {editingNode.order_index === 9 ? 'Nome da Biblioteca' : 'Título'}
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editingNode.title}
                    onChange={(e) => setEditingNode({ ...editingNode, title: e.target.value })}
                    placeholder={editingNode.order_index === 9 ? "Ex: Biblioteca de Recursos" : "Ex: Módulo 1: Introdução"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Descrição</label>
                  <textarea 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none h-24"
                    value={editingNode.description}
                    onChange={(e) => setEditingNode({ ...editingNode, description: e.target.value })}
                    placeholder="O que o aluno vai aprender?"
                  />
                </div>
              </div>

              {/* Gerenciamento de Links e Materiais */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider">Links e Materiais</label>
                  <button 
                    onClick={addLink}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1 rounded-md border border-slate-700 transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Link
                  </button>
                </div>
                
                <div className="space-y-3">
                  {editingNode.links?.map((link, index) => (
                    <div key={index} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl space-y-3 relative group/link">
                      <button 
                        onClick={() => removeLink(index)}
                        className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover/link:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <select 
                          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                          value={link.type}
                          onChange={(e) => updateLink(index, 'type', e.target.value as any)}
                        >
                          <option value="course">Curso</option>
                          <option value="youtube">YouTube</option>
                          <option value="reference">Referência</option>
                        </select>
                        <input 
                          type="text" 
                          placeholder="Título do Link"
                          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                          value={link.title}
                          onChange={(e) => updateLink(index, 'title', e.target.value)}
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="URL (https://...)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
                        value={link.url}
                        onChange={(e) => updateLink(index, 'url', e.target.value)}
                      />
                      <input 
                        type="text" 
                        placeholder="Credenciais (opcional)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 outline-none"
                        value={link.credentials || ''}
                        onChange={(e) => updateLink(index, 'credentials', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rodapé do Modal de Edição */}
            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setEditingNode(null)}
                className="px-6 py-2 text-slate-400 hover:text-white transition-all font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveNode}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
              >
                {editingNode.order_index === 9 ? 'Salvar Biblioteca' : 'Salvar Módulo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
