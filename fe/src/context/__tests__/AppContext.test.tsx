import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppProvider, useAppContext } from '../AppContext';

// Test component that uses the context
const TestComponent: React.FC = () => {
  const { bookInfo, setBookName, fileState, setFileName } = useAppContext();

  return (
    <div>
      <div data-testid="book-name">{bookInfo.bookName}</div>
      <div data-testid="file-name">{fileState.fileName}</div>
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
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAppContext must be used within an AppProvider');

    consoleSpy.mockRestore();
  });
});
