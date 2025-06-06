import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import { AppProvider } from '../../context/AppContext';

// Mock the context
const mockAddNotification = jest.fn();
const mockRemoveNotification = jest.fn();
const mockClearNotifications = jest.fn();

jest.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    addNotification: mockAddNotification,
    removeNotification: mockRemoveNotification,
    clearNotifications: mockClearNotifications,
  }),
}));

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show success notification', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.showSuccess('Success!', 'Operation completed successfully');
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Success!',
        message: 'Operation completed successfully',
        autoHide: true,
        duration: 5000,
      })
    );
  });

  it('should show error notification', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.showError('Error!', 'Something went wrong');
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Error!',
        message: 'Something went wrong',
        autoHide: true,
        duration: 5000,
      })
    );
  });

  it('should show warning notification', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.showWarning('Warning!', 'Please be careful');
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        title: 'Warning!',
        message: 'Please be careful',
        autoHide: true,
        duration: 5000,
      })
    );
  });

  it('should show info notification', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.showInfo('Info', 'Here is some information');
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: 'Info',
        message: 'Here is some information',
        autoHide: true,
        duration: 5000,
      })
    );
  });

  it('should allow custom options', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.showSuccess('Success!', 'Custom options', {
        autoHide: false,
        duration: 10000,
      });
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Success!',
        message: 'Custom options',
        autoHide: false,
        duration: 10000,
      })
    );
  });

  it('should generate unique IDs for notifications', () => {
    const { result } = renderHook(() => useNotifications());

    let firstId: string = '';
    let secondId: string = '';

    act(() => {
      firstId = result.current.showSuccess('First');
      secondId = result.current.showSuccess('Second');
    });

    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(firstId).not.toBe(secondId);
  });
});
