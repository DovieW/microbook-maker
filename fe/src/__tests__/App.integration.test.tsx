// React import not needed for this test file
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock the getBookInfo utility
jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  getBookInfo: jest.fn(),
}));

describe('App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the main components', () => {
    render(<App />);

    expect(screen.getByText('MicroBook Maker')).toBeInTheDocument();
    expect(screen.getByLabelText('Book Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Author')).toBeInTheDocument();
    expect(screen.getByLabelText('Font Size')).toBeInTheDocument();
    expect(screen.getByText('Select TXT')).toBeInTheDocument();
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

    expect(fontSizeInput).toHaveValue(8); // Number input returns number
  });

  it('should show initial state correctly', () => {
    render(<App />);

    // Check initial display values
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
    const mockGetBookInfo = require('../utils').getBookInfo;
    mockGetBookInfo.mockResolvedValue({
      author: 'Fetched Author',
      publishYear: '2023',
    });

    render(<App />);

    // First set a book name
    const bookNameInput = screen.getByLabelText('Book Name');
    fireEvent.change(bookNameInput, { target: { value: 'Test Book' } });

    // Click the refresh button (it's an icon button with a tooltip)
    const refreshButton = screen.getByTestId('RefreshIcon').closest('button')!;
    fireEvent.click(refreshButton);

    // Wait for the API call to complete and state to update
    await waitFor(() => {
      expect(screen.getByLabelText('Author')).toHaveValue('Fetched Author');
    });

    expect(screen.getByLabelText('Year')).toHaveValue(2023);
    expect(mockGetBookInfo).toHaveBeenCalledWith('Test Book');
  });

  it('should handle API errors gracefully', async () => {
    const mockGetBookInfo = require('../utils').getBookInfo;
    mockGetBookInfo.mockRejectedValue(new Error('API Error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<App />);

    const bookNameInput = screen.getByLabelText('Book Name');
    fireEvent.change(bookNameInput, { target: { value: 'Test Book' } });

    const refreshButton = screen.getByTestId('RefreshIcon').closest('button')!;
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch book info:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});
