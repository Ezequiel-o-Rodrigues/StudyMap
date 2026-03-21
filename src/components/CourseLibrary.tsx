import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { StudyNode, StudyLink } from '../types';
import { BookOpen, ExternalLink, Key, BrainCircuit, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AssessmentChat from './AssessmentChat';
import { supabase } from '../services/supabase';

export default function CourseLibrary() {
  const [libraryNode, setLibraryNode] = useState<StudyNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<StudyLink | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchLibrary();
  }, []);

  async function fetchLibrary() {
    try {
      setLoading(true);
      const nodes = await api.getNodes();
      // Encontra o módulo 10 (order_index 9)
      const node10 = nodes.find((n: any) => n.order_index === 9);
      if (node10) {
        setLibraryNode(node10);
      }
    } catch (error) {
      console.error('Erro ao buscar biblioteca:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full py-12 flex justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!libraryNode) return null;

  return (
    <div className="mt-16 space-y-8">
      {/* Botão de Toggle da Biblioteca Centralizado */}
      <div className="flex justify-center px-4">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-3 md:gap-4 px-6 md:px-8 py-3 md:py-4 rounded-full border-2 transition-all shadow-xl w-full sm:w-auto justify-center ${
            isOpen 
              ? 'bg-blue-600 border-blue-500 text-white shadow-blue-600/20' 
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-blue-500/50 hover:text-blue-400'
          }`}
        >
          <BookOpen className={`w-5 h-5 md:w-6 md:h-6 ${isOpen ? 'text-white' : 'text-blue-500'}`} />
          <span className="text-sm md:text-lg font-black tracking-tighter uppercase">
            {isOpen ? 'Fechar Biblioteca' : 'Biblioteca de Cursos'}
          </span>
          <ChevronRight className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
              {libraryNode.links.map((link, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group bg-slate-900 border border-slate-800 p-6 rounded-3xl hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col h-full"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                        <BookOpen className="w-6 h-6 text-blue-400" />
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                        Curso Externo
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white mb-2 tracking-tight group-hover:text-blue-400 transition-colors">
                      {link.title}
                    </h3>

                    {link.credentials && (
                      <div className="mt-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-start gap-3">
                        <Key className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          <span className="text-slate-500 font-bold uppercase tracking-tighter block mb-0.5">Acesso:</span>
                          {link.credentials}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700"
                    >
                      <ExternalLink className="w-4 h-4" /> Acessar Conteúdo
                    </a>
                    
                    <button
                      onClick={() => setSelectedLink(link)}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 uppercase text-xs tracking-widest"
                    >
                      <BrainCircuit className="w-4 h-4" /> Treinamento IA
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLink(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-[95vw] h-[90vh] bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-xl border border-blue-500/20">
                    <BrainCircuit className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tighter uppercase">Treinamento IA</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedLink.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLink(null)}
                  className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronRight className="w-6 h-6 rotate-90" />
                </button>
              </div>

              <div className="flex-1 p-0 h-full min-h-0 flex flex-col overflow-hidden">
                <AssessmentChat
                  node={libraryNode}
                  initialLink={selectedLink}
                  onComplete={() => {}}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
