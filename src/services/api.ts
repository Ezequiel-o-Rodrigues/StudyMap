/**
 * Serviço de API para comunicação com o backend Neon (via Express)
 */
import { supabase } from './supabase';

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`
  };
}

export const api = {
  // Módulos (Nodes)
  async getNodes() {
    const headers = await getHeaders();
    const res = await fetch('/api/nodes', { headers });
    return res.json();
  },
  async createNode(node: any) {
    const headers = await getHeaders();
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers,
      body: JSON.stringify(node)
    });
    return res.json();
  },
  async updateNode(id: string, node: any) {
    const headers = await getHeaders();
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(node)
    });
    return res.json();
  },
  async deleteNode(id: string) {
    const headers = await getHeaders();
    const res = await fetch(`/api/nodes/${id}`, { 
      method: 'DELETE',
      headers
    });
    return res.json();
  },

  // Progresso
  async getProgress(userId: string) {
    const headers = await getHeaders();
    const res = await fetch(`/api/progress/${userId}`, { headers });
    return res.json();
  },
  async saveProgress(progress: any) {
    const headers = await getHeaders();
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers,
      body: JSON.stringify(progress)
    });
    return res.json();
  },

  // Relatórios
  async getReports(userId: string) {
    const headers = await getHeaders();
    const res = await fetch(`/api/reports/${userId}`, { headers });
    return res.json();
  },
  async getReportByNode(nodeId: string, userId: string) {
    const headers = await getHeaders();
    const res = await fetch(`/api/reports/node/${nodeId}?userId=${userId}`, { headers });
    return res.json();
  },
  async saveReport(report: any) {
    const headers = await getHeaders();
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers,
      body: JSON.stringify(report)
    });
    return res.json();
  },

  // Avaliações (Cache)
  async generateAssessment(data: { node_id: string, node_title: string, link_url: string, difficulty: string, user_email?: string }) {
    const headers = await getHeaders();
    const res = await fetch('/api/assessments/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao gerar avaliação');
    return res.json();
  },
  async getAssessmentCache(nodeId: string, url: string, difficulty: string) {
    const headers = await getHeaders();
    const res = await fetch(`/api/assessments/bank?node_id=${nodeId}&url=${encodeURIComponent(url)}&difficulty=${difficulty}`, { headers });
    return res.json();
  },
  async clearAssessmentCache(nodeId: string, url: string, difficulty: string) {
    const headers = await getHeaders();
    const res = await fetch(`/api/assessments/cache?node_id=${nodeId}&link_url=${encodeURIComponent(url)}&difficulty=${difficulty}`, { 
      method: 'DELETE',
      headers 
    });
    return res.json();
  },
  async saveAssessmentCache(questions: any[]) {
    const headers = await getHeaders();
    const res = await fetch('/api/assessments/bank', {
      method: 'POST',
      headers,
      body: JSON.stringify(questions)
    });
    return res.json();
  },

  // Resultados de Testes
  async getTestResults(userId: string, nodeId?: string) {
    const headers = await getHeaders();
    const url = nodeId ? `/api/assessments/results/${userId}?node_id=${nodeId}` : `/api/assessments/results/${userId}`;
    const res = await fetch(url, { headers });
    return res.json();
  },
  async saveTestResult(result: any) {
    const headers = await getHeaders();
    const res = await fetch('/api/assessments/results', {
      method: 'POST',
      headers,
      body: JSON.stringify(result)
    });
    return res.json();
  },

  // Roles
  async getUserRole(userId: string) {
    const headers = await getHeaders();
    const res = await fetch(`/api/roles/${userId}`, { headers });
    return res.json();
  },
  async saveUserRole(userId: string, role: string, email?: string, promoCode?: string) {
    const headers = await getHeaders();
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, role, email, promoCode })
    });
    return res.json();
  },

  // Profiles
  async saveProfile(profile: { user_id: string, full_name: string, email?: string, avatar_url?: string }) {
    const headers = await getHeaders();
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers,
      body: JSON.stringify(profile)
    });
    return res.json();
  },

  // Admin
  async adminGetStudents() {
    const headers = await getHeaders();
    const res = await fetch('/api/admin/students', { headers });
    return res.json();
  },
  async adminGetReports() {
    const headers = await getHeaders();
    const res = await fetch('/api/admin/reports', { headers });
    return res.json();
  },
  async adminGetProfiles() {
    const headers = await getHeaders();
    const res = await fetch('/api/admin/profiles', { headers });
    return res.json();
  },
  async adminReviewReport(id: string, status: string, feedback: string) {
    const headers = await getHeaders();
    const res = await fetch('/api/admin/review-report', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, status, teacher_feedback: feedback })
    });
    return res.json();
  }
};
