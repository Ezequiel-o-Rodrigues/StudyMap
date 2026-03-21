/**
 * Auth.tsx - Componente de Autenticação (Login e Cadastro).
 * Gerencia a criação de contas de estudantes e o acesso à plataforma.
 */
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import toast from 'react-hot-toast';

export default function Auth() {
  // Estados para gerenciar o formulário e o modo (Login ou Cadastro)
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  /**
   * Processa a autenticação (Login ou Cadastro) via Supabase Auth.
   */
  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        // Realiza o login com e-mail e senha
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Realiza o cadastro de um novo usuário
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            // Salva o nome social nos metadados do usuário
            data: {
              full_name: fullName
            }
          }
        });
        if (error) throw error;
        
        if (data.user) {
          try {
            // Cria um perfil na tabela 'profiles' no Neon via API
            await api.saveProfile({
              user_id: data.user.id,
              full_name: fullName,
              email: email
            });

            // O backend irá promover automaticamente se o promoCode for válido (removido daqui, agora é via sidebar)
            const roleResult = await api.saveUserRole(data.user.id, 'student', email);
            
            if (roleResult.error) {
              console.warn('Erro ao salvar role:', roleResult.error);
            }
          } catch (apiError) {
            console.error('Erro ao sincronizar com banco de dados:', apiError);
            toast.error('Conta criada no Supabase, mas houve um erro ao sincronizar seu perfil. Tente fazer login e completar seu cadastro.');
          }
        }

        toast.success('Usuário criado com sucesso!');
      }
    } catch (error: any) {
      // Tratamento de erros comuns para mensagens amigáveis
      let message = error.message || 'Erro na autenticação';
      
      if (message.includes('User already registered')) {
        message = 'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.';
      } else if (message.includes('Invalid login credentials')) {
        message = 'E-mail ou senha incorretos.';
      }
      
      toast.error(message);
      console.error('Erro detalhado:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-slate-950 p-4">
      {/* Card de Autenticação */}
      <div className="w-full max-w-sm p-8 space-y-6 bg-slate-900 rounded-2xl border border-slate-700/80 shadow-2xl shadow-blue-900/20">
        
        {/* Logo e Cabeçalho do Card */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-2xl shadow-xl">
              <img 
                src="https://techify.one/logo-techify.png" 
                alt="Techify Logo" 
                className="w-16 h-16 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">
              TECHIFY <span className="text-blue-500">STUDYMAP</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isLogin ? 'Entre com suas credenciais' : 'Crie sua conta de estudante'}
            </p>
          </div>
        </div>
        
        {/* Formulário de Autenticação */}
        <form className="space-y-4" onSubmit={handleAuth}>
          {/* Campo Nome Social - Visível apenas no Cadastro */}
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Nome Social</label>
              <input
                className="w-full px-4 py-3 text-slate-100 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
                type="text"
                placeholder="Como quer ser chamado?"
                value={fullName}
                required
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}
          
          {/* Campo E-mail */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">E-mail</label>
            <input
              className="w-full px-4 py-3 text-slate-100 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
              type="email"
              placeholder="seu@email.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Campo Senha */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Senha</label>
            <input
              className="w-full px-4 py-3 text-slate-100 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
              type="password"
              placeholder="Sua senha"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Botão de Ação */}
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg shadow-blue-600/20 active:scale-[0.98]" 
            disabled={loading}
          >
            {loading ? 'Processando...' : (isLogin ? 'Entrar Agora' : 'Criar Minha Conta')}
          </button>
        </form>

        {/* Alternância entre Login e Cadastro */}
        <div className="pt-4 border-t border-slate-800">
          <p className="text-sm text-center text-slate-500">
            {isLogin ? 'Ainda não tem acesso?' : 'Já possui uma conta?'}{' '}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              {isLogin ? 'Cadastre-se' : 'Fazer Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
