import api from '../utils/api';

export const jobService = {
  // 获取岗位列表
  async getJobs() {
    try {
      const response = await api.get('/jobs/list');
      return response.data;
    } catch (error) {
      console.error('获取岗位列表失败:', error);
      throw error;
    }
  },

  // 创建岗位
  async createJob(jobData) {
    try {
      const response = await api.post('/jobs/create', jobData);
      return response.data;
    } catch (error) {
      console.error('创建岗位失败:', error);
      throw error;
    }
  },

  // 更新岗位
  async updateJob(jobId, jobData) {
    try {
      const response = await api.put(`/jobs/${jobId}`, jobData);
      return response.data;
    } catch (error) {
      console.error('更新岗位失败:', error);
      throw error;
    }
  },

  // 删除岗位
  async deleteJob(jobId) {
    try {
      const response = await api.delete(`/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      console.error('删除岗位失败:', error);
      throw error;
    }
  }
};