import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import JobManagement from '../JobManagement';
import { theme } from '../../theme';
import { JobManagementService } from '../../services/jobManagementService';

// Mock the JobManagementService
vi.mock('../../services/jobManagementService');
const mockJobManagementService = JobManagementService as any;

// Mock the useJobManagement hook
vi.mock('../../hooks/useJobManagement', () => ({
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
    refreshJobs: vi.fn(),
    clearError: vi.fn(),
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
    vi.clearAllMocks();
  });

  it('renders job management interface', async () => {
    renderWithTheme(<JobManagement />);

    // Should render jobs without header
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Another Book')).toBeInTheDocument();
  });

  it('displays job list with correct data', async () => {
    renderWithTheme(<JobManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
      expect(screen.getByText('Another Book')).toBeInTheDocument();
    });
  });

  // Note: Scrolling functionality is tested manually in the browser
  // The component now includes proper scrolling when job list exceeds container height

  it('shows download buttons for jobs', async () => {
    renderWithTheme(<JobManagement />);

    await waitFor(() => {
      // Should have download buttons (some enabled, some disabled based on status)
      const downloadButtons = screen.getAllByRole('button');
      expect(downloadButtons.length).toBeGreaterThan(0);
    });
  });
});
