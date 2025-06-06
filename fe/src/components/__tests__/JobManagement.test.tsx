import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import JobManagement from '../JobManagement';
import { theme } from '../../theme';
import { JobManagementService } from '../../services/jobManagementService';

// Mock the JobManagementService
jest.mock('../../services/jobManagementService');
const mockJobManagementService = JobManagementService as jest.Mocked<typeof JobManagementService>;

// Mock the useJobManagement hook
jest.mock('../../hooks/useJobManagement', () => ({
  useJobManagement: () => ({
    jobs: [
      {
        id: 'test-job-1',
        bookName: 'Test Book',
        fontSize: '6',
        status: 'completed',
        progress: {
          step: 'Complete',
          percentage: 100,
          isComplete: true,
          isError: false
        },
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:05:00Z',
        originalFileName: 'test.txt',
        uploadPath: 'test-upload.txt'
      },
      {
        id: 'test-job-2',
        bookName: 'Another Book',
        fontSize: '8',
        status: 'in_progress',
        progress: {
          step: 'Creating pages',
          percentage: 45,
          isComplete: false,
          isError: false
        },
        createdAt: '2023-01-01T01:00:00Z',
        completedAt: null,
        originalFileName: 'another.txt',
        uploadPath: 'another-upload.txt'
      }
    ],
    loading: false,
    error: null,
    refreshJobs: jest.fn(),
    clearError: jest.fn(),
  })
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('JobManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders job management interface', async () => {
    renderWithTheme(<JobManagement />);
    
    expect(screen.getByText('PDF Generation Jobs')).toBeInTheDocument();
    expect(screen.getByText('Book Details')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('displays job list with correct data', async () => {
    renderWithTheme(<JobManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
      expect(screen.getByText('Another Book')).toBeInTheDocument();
      expect(screen.getByText('Font: 6pt')).toBeInTheDocument();
      expect(screen.getByText('Font: 8pt')).toBeInTheDocument();
    });
  });

  it('shows correct status chips', async () => {
    renderWithTheme(<JobManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });

  it('displays progress information', async () => {
    renderWithTheme(<JobManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Creating pages')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });
});
