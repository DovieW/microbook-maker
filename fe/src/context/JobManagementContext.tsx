import React, { createContext, useContext, ReactNode } from 'react';
import { useJobManagement } from '../hooks/useJobManagement';
import { UseJobManagementReturn } from '../types';

const JobManagementContext = createContext<UseJobManagementReturn | undefined>(undefined);

interface JobManagementProviderProps {
  children: ReactNode;
}

export function JobManagementProvider({ children }: JobManagementProviderProps) {
  const jobManagement = useJobManagement();

  return (
    <JobManagementContext.Provider value={jobManagement}>
      {children}
    </JobManagementContext.Provider>
  );
}

export function useJobManagementContext() {
  const context = useContext(JobManagementContext);
  if (context === undefined) {
    throw new Error('useJobManagementContext must be used within a JobManagementProvider');
  }
  return context;
}
