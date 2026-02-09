import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { AppProvider, useAppContext } from '../AppContext';

vi.mock('../../hooks/useCapabilities', () => ({
  useCapabilities: () => ({
    capabilities: {
      acceptedFormats: ['.txt'],
      maxUploadSizeBytes: 10 * 1024 * 1024,
      fontOptions: [{ value: 'dejavu-sans', label: 'DejaVu Sans' }],
      defaults: {
        format: '.txt',
        borderStyle: 'dashed',
        fontSize: '6',
        fontFamily: 'dejavu-sans',
      },
    },
    capabilitiesLoading: false,
    capabilitiesError: null,
    refreshCapabilities: vi.fn(),
  }),
}));

const TestComponent: React.FC = () => {
  const { bookInfo, setBookName, fileState, setFileName, pdfOptions } = useAppContext();

  return (
    <div>
      <div data-testid="book-name">{bookInfo.bookName}</div>
      <div data-testid="file-name">{fileState.fileName}</div>
      <div data-testid="font-family">{pdfOptions.fontFamily}</div>
      <button onClick={() => setBookName('Test Book')}>Set Book Name</button>
      <button onClick={() => setFileName('test.txt')}>Set File Name</button>
    </div>
  );
};

describe('AppContext', () => {
  it('should provide context values to children', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('book-name')).toHaveTextContent('');
    expect(screen.getByTestId('file-name')).toHaveTextContent('');
  });

  it('should align selected font family with capabilities defaults', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('font-family')).toHaveTextContent('dejavu-sans');
  });

  it('should update context values when actions are called', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    act(() => {
      screen.getByText('Set Book Name').click();
    });

    expect(screen.getByTestId('book-name')).toHaveTextContent('Test Book');

    act(() => {
      screen.getByText('Set File Name').click();
    });

    expect(screen.getByTestId('file-name')).toHaveTextContent('test.txt');
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAppContext must be used within an AppProvider');

    consoleSpy.mockRestore();
  });
});
