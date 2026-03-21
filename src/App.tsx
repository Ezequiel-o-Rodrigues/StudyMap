/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * App.tsx - Ponto de entrada principal da aplicação.
 * Gerencia a autenticação, o papel do usuário (Admin/Aluno) e a navegação entre as visões.
 */
import { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';
import { LogOut, Trophy, LayoutDashboard, Map as MapIcon, Users, Menu, X, Settings, HelpCircle, Key, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import Auth from './components/Auth';
import HorizontalMap from './components/HorizontalMap';
import CourseLibrary from './components/CourseLibrary';
import AdminDashboard from './components/AdminDashboard';
import StudentsDashboard from './components/StudentsDashboard';
import { UserRole } from './types';
import { api } from './services/api';

export default function App() {
  // Estados para gerenciar a sessão do usuário, progresso, visão atual e papel (role)
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [view, setView] = useState<'map' | 'admin' | 'students'>('map');
  const [role, setRole] = useState<UserRole>(UserRole.Student);
  const [promoCode, setPromoCode] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  /**
   * Busca o papel (role) do usuário no banco de dados Neon e garante que o perfil existe.
   * @param session Sessão do usuário autenticado
   */
  const fetchUserRole = async (session: Session) => {
    const userId = session.user.id;
    try {
      const data = await api.getUserRole(userId);
      
      // Se não houver role no banco (o backend retorna student por padrão mas sem registro),
      // ou se quisermos garantir que o perfil está sincronizado:
      const email = session.user.email || '';
      const fullName = session.user.user_metadata?.full_name || email.split('@')[0];

      // Sincroniza perfil no Neon (garante que o instrutor veja o aluno)
      await api.saveProfile({
        user_id: userId,
        full_name: fullName,
        email: email
      });

      // Garante que a role está salva no Neon
      let currentRole = data.role || 'student';
      
      if (email === 'ezequielrod2020@gmail.com' || email === 'admin@techify.one') {
        currentRole = 'admin';
        if (data.role !== 'admin') {
          await api.saveUserRole(userId, 'admin', email);
        }
      } else if (!data.user_id) {
        await api.saveUserRole(userId, currentRole, email);
      }

      setRole(currentRole === 'admin' ? UserRole.Admin : UserRole.Student);
    } catch (err) {
      console.error('Erro ao buscar role segura:', err);
      setRole(UserRole.Student);
    }
  };

  /**
   * Efeito para monitorar mudanças no estado de autenticação.
   */
  useEffect(() => {
    // Verifica sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session);
      }
    });

    // Escuta mudanças (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session);
      } else {
        // Reset de estado ao deslogar
        setRole(UserRole.Student);
        setView('map');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePromote = async () => {
    try {
      const userId = session?.user.id;
      if (!userId) return;
      const result = await api.saveUserRole(userId, 'student', session.user.email, promoCode);
      
      if (result.role === 'admin') {
        setRole(UserRole.Admin);
        toast.success('Parabéns! Você agora é um Instrutor.');
        setIsSidebarOpen(false);
      } else {
        toast.error('Código inválido ou erro na promoção.');
      }
    } catch (err) {
      toast.error('Erro ao processar promoção.');
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setIsChangingPassword(false);
      setNewPassword('');
    } catch (err: any) {
      toast.error('Erro ao alterar senha: ' + err.message);
    }
  };

  // Cálculo da porcentagem de progresso para a barra visual do aluno
  const progressPercentage = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  // Se não houver sessão, exibe a tela de login/cadastro
  if (!session) {
    return <Auth />;
  } else {
    return (
      <main className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
          },
        }} />
        {/* Header Techify - Contém logo, título, barra de progresso e controles de navegação */}
        <header className="w-full border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
            
            {/* Logo e Título com link para o site oficial */}
            <div className="flex items-center gap-3">
              <a 
                href="https://techify.one" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity shrink-0"
              >
                <div className="bg-white p-1 rounded-lg shadow-lg shadow-blue-600/10">
                  <img 
                    src="https://techify.one/logo-techify.png" 
                    alt="Techify Logo" 
                    className="w-8 h-8 md:w-10 md:h-10 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </a>
              <div className="min-w-0">
                <a 
                  href="https://techify.one" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors"
                >
                  <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white truncate">
                    TECHIFY <span className="text-blue-500">STUDYMAP</span>
                  </h1>
                </a>
                <p className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-widest truncate">
                  {role === UserRole.Admin ? 'Painel Instrutor' : 'Plataforma de Evolução'}
                </p>
              </div>
            </div>

            {/* Barra de Progresso - Visível apenas para alunos */}
            {role === UserRole.Student && (
              <div className="flex-1 max-w-md mx-auto w-full md:px-4">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 md:w-3.5 md:h-3.5 text-yellow-500" /> Progresso
                  </span>
                  <span className="text-xs md:text-sm font-black text-blue-400">{progressPercentage}%</span>
                </div>
                <div className="h-2 md:h-2.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                  />
                </div>
              </div>
            )}

            {/* Controles de navegação e Perfil */}
            <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4">
              {/* Menu de abas - Visível apenas para administradores */}
              {role === UserRole.Admin && (
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 overflow-x-auto custom-scrollbar max-w-[240px] sm:max-w-none">
                  <button 
                    onClick={() => setView('map')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-all shrink-0 ${view === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <MapIcon className="w-3.5 h-3.5 md:w-4 md:h-4" /> Mapa
                  </button>
                  <button 
                    onClick={() => setView('admin')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-all shrink-0 ${view === 'admin' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 md:w-4 md:h-4" /> Admin
                  </button>
                  <button 
                    onClick={() => setView('students')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-all shrink-0 ${view === 'students' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Users className="w-3.5 h-3.5 md:w-4 md:h-4" /> Alunos
                  </button>
                </div>
              )}
              
              {/* Botão do Menu (Hamburger) */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 md:p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 shrink-0"
                title="Configurações"
              >
                <Menu className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
          </div>
        </header>

        {/* Sidebar de Configurações */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />
              {/* Painel Lateral */}
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-xs bg-slate-900 border-l border-slate-800 z-50 shadow-2xl flex flex-col"
              >
                {/* Cabeçalho da Sidebar */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-500" />
                    <h3 className="font-black text-white uppercase tracking-widest text-sm">Configurações</h3>
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Conteúdo da Sidebar */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Perfil Rápido */}
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Logado como</p>
                    <p className="text-sm font-bold text-white truncate">{session.user.email}</p>
                    <p className="text-[10px] font-bold text-blue-400 uppercase mt-1">
                      {role === UserRole.Admin ? 'Instrutor' : 'Estudante'}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2">Conta e Segurança</p>
                    
                    {/* Alterar Senha */}
                    <div className="space-y-2">
                      <button 
                        onClick={() => setIsChangingPassword(!isChangingPassword)}
                        className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Key className="w-4 h-4 text-slate-400 group-hover:text-blue-400" />
                          <span className="text-sm font-bold text-slate-300">Alterar Senha</span>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${isChangingPassword ? 'rotate-90' : ''}`} />
                      </button>
                      
                      {isChangingPassword && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-3"
                        >
                          <input 
                            type="password" 
                            placeholder="Nova senha"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                          <button 
                            onClick={handleChangePassword}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black py-2 rounded-lg uppercase tracking-widest transition-all"
                          >
                            Confirmar Nova Senha
                          </button>
                        </motion.div>
                      )}
                    </div>

                    {/* Sou Professor? (Apenas para estudantes) */}
                    {role === UserRole.Student && (
                      <div className="pt-4 mt-4 border-t border-slate-800 space-y-3">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Acesso Instrutor</p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Código de Professor"
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                          />
                          <button 
                            onClick={handlePromote}
                            className="bg-slate-700 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all"
                          >
                            Validar
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-500 italic px-1">Insira o código secreto para liberar as ferramentas de instrutor.</p>
                      </div>
                    )}
                  </div>

                  {/* Suporte e Ajuda */}
                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    <a 
                      href="mailto:studymapsuporte@gmail.com"
                      className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-all group"
                    >
                      <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
                      <span className="text-sm font-bold text-slate-300">Suporte e Ajuda</span>
                    </a>
                  </div>
                </div>

                {/* Rodapé da Sidebar (Sair) */}
                <div className="p-6 border-t border-slate-800">
                  <button 
                    onClick={() => {
                      supabase.auth.signOut();
                      setIsSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-red-900/10 hover:bg-red-900/20 text-red-500 rounded-xl border border-red-900/20 transition-all font-black uppercase tracking-widest text-xs"
                  >
                    <LogOut className="w-4 h-4" /> Sair da Conta
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Conteúdo Principal - Renderiza a visão selecionada baseada no estado 'view' */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-7xl">
            {view === 'admin' && role === UserRole.Admin ? (
              <AdminDashboard />
            ) : view === 'students' && role === UserRole.Admin ? (
              <StudentsDashboard />
            ) : (
              <>
                {/* Cabeçalho da Trilha */}
                <div className="mb-8 md:mb-12 text-center">
                  <h2 className="text-3xl md:text-4xl font-black text-white mb-2 md:mb-3 tracking-tighter uppercase">Trilha de Aprendizado</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">Complete os módulos para desbloquear novos desafios.</p>
                </div>

                {/* O Mapa Horizontal de Estudos */}
                <HorizontalMap 
                  isAdmin={role === UserRole.Admin}
                  onGoToAdmin={() => setView('admin')}
                  onProgressUpdate={(completed, total) => setProgress({ completed, total })} 
                />

                {/* Biblioteca de Cursos (Módulo 10) */}
                <CourseLibrary />
              </>
            )}
          </div>
        </div>
        
        {/* Rodapé Padrão */}
        <footer className="py-6 border-t border-slate-900 text-center">
          <p className="text-xs text-slate-600 font-medium tracking-widest uppercase">
            &copy; 2025 Techify - Todos os direitos reservados
          </p>
        </footer>
      </main>
    );
  }
}
