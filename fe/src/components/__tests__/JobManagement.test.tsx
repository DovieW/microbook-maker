import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import JobManagement from '../JobManagement';
import { theme } from '../../theme';
import { JobManagementProvider } from '../../context/JobManagementContext';
import { AppProvider } from '../../context/AppContext';

vi.mock('../../hooks/useCapabilities', () => ({
  useCapabilities: () => ({
    capabilities: {
      acceptedFormats: ['.txt'],
      maxUploadSizeBytes: 10 * 1024 * 1024,
      fontOptions: [{ value: 'arial', label: 'Arial' }],
      defaults: {
        format: '.txt',
        borderStyle: 'dashed',
        fontSize: '6',
        fontFamily: 'arial',
      },
    },
    capabilitiesLoading: false,
    capabilitiesError: null,
    refreshCapabilities: vi.fn(),
  }),
}));

vi.mock('../../hooks/useJobManagement', () => ({
  useJobManagement: () => ({
    jobs: [
      {
        id: 'test-job-1',
        bookName: 'Test Book',
        fontSize: '6',
        fontFamily: 'arial',
        borderStyle: 'dashed',
        author: 'Test Author',
        year: '2023',
        series: 'Test Series',
        status: 'completed',
        progress: {
          step: 'Complete',
          percentage: 100,
          isComplete: true,
          isError: false,
        },
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:05:00Z',
        originalFileName: 'test.txt',
        uploadPath: 'test-upload.txt',
      },
      {
        id: 'test-job-2',
        bookName: 'Another Book',
        fontSize: '8',
        fontFamily: 'arial',
        borderStyle: null,
        author: null,
        year: null,
        series: null,
        status: 'in_progress',
        progress: {
          step: 'Creating pages',
          percentage: 45,
          isComplete: false,
          isError: false,
        },
        createdAt: '2023-01-01T01:00:00Z',
        completedAt: null,
        originalFileName: 'another.txt',
        uploadPath: 'another-upload.txt',
      },
    ],
    loading: false,
    error: null,
    refreshJobs: vi.fn(),
    clearError: vi.fn(),
    addNewJob: vi.fn(),
    deleteJob: vi.fn(),
    onScrollToTop: vi.fn(),
  }),
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <AppProvider>
        <JobManagementProvider>{component}</JobManagementProvider>
      </AppProvider>
    </ThemeProvider>
  );
};

describe('JobManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders job management interface', () => {
    renderWithProviders(<JobManagement />);

    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Another Book')).toBeInTheDocument();
  });

  it('displays job list with correct data', async () => {
    renderWithProviders(<JobManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
      expect(screen.getByText('Another Book')).toBeInTheDocument();
    });
  });

  it('shows action buttons for jobs', async () => {
    renderWithProviders(<JobManagement />);

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
