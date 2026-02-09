import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import App from '../App';

const mockFetchBookInfo = vi.fn();

vi.mock('../hooks/useOpenLibrary', () => ({
  useOpenLibrary: () => ({
    fetchBookInfo: mockFetchBookInfo,
    loading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

vi.mock('../hooks/useJobManagement', () => ({
  useJobManagement: () => ({
    jobs: [],
    loading: false,
    error: null,
    refreshJobs: vi.fn(),
    clearError: vi.fn(),
    addNewJob: vi.fn(),
    deleteJob: vi.fn(),
    onScrollToTop: vi.fn(),
  }),
}));

vi.mock('../hooks/useCapabilities', () => ({
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

describe('App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the main components', () => {
    render(<App />);

    expect(screen.getByText('MicroBook Maker')).toBeInTheDocument();
    expect(screen.getByLabelText('Book Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Author')).toBeInTheDocument();
    expect(screen.getByLabelText('Font Size')).toBeInTheDocument();
    expect(screen.getByText('Select File')).toBeInTheDocument();
  });

  it('should update book name when typed', () => {
    render(<App />);

    const bookNameInput = screen.getByLabelText('Book Name');
    fireEvent.change(bookNameInput, { target: { value: 'Test Book' } });

    expect(bookNameInput).toHaveValue('Test Book');
  });

  it('should update author when typed', () => {
    render(<App />);

    const authorInput = screen.getByLabelText('Author');
    fireEvent.change(authorInput, { target: { value: 'Test Author' } });

    expect(authorInput).toHaveValue('Test Author');
  });

  it('should update font size when changed', () => {
    render(<App />);

    const fontSizeInput = screen.getByLabelText('Font Size');
    fireEvent.change(fontSizeInput, { target: { value: '8' } });

    expect(fontSizeInput).toHaveValue(8);
  });

  it('should show initial state correctly', () => {
    render(<App />);

    expect(screen.getByText(/Words:\s*--/)).toBeInTheDocument();
    expect(screen.getByText(/Sheets:\s*--/)).toBeInTheDocument();
    expect(screen.getByText(/Read Time:\s*--/)).toBeInTheDocument();
  });

  it('should have Generate button disabled initially', () => {
    render(<App />);

    const generateButton = screen.getByText('Generate');
    expect(generateButton).toBeDisabled();
  });

  it('should fetch book info when refresh button is clicked', async () => {
    mockFetchBookInfo.mockResolvedValue({
      author: 'Fetched Author',
      publishYear: '2023',
    });

    render(<App />);

    const bookNameInput = screen.getByLabelText('Book Name');
    fireEvent.change(bookNameInput, { target: { value: 'Test Book' } });

    const refreshButton = screen.getByTestId('RefreshIcon').closest('button');
    fireEvent.click(refreshButton!);

    await waitFor(() => {
      expect(mockFetchBookInfo).toHaveBeenCalledWith('Test Book');
    });
  });

  it('should handle missing API data gracefully', async () => {
    mockFetchBookInfo.mockResolvedValue(null);

    render(<App />);

    const bookNameInput = screen.getByLabelText('Book Name');
    fireEvent.change(bookNameInput, { target: { value: 'Test Book' } });

    const refreshButton = screen.getByTestId('RefreshIcon').closest('button');
    fireEvent.click(refreshButton!);

    await waitFor(() => {
      expect(mockFetchBookInfo).toHaveBeenCalledWith('Test Book');
    });
  });
});
