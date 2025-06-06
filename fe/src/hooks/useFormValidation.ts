import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNotifications } from './useNotifications';
import {
  validateFontSize,
  validateFile,
  validateFileContent,
  validateBookName,
  validateAuthor,
  validateYear,
  validateFormData,
  getValidationGuidance,
  ValidationResult
} from '../utils/validation';

interface FormValidationState {
  bookName: ValidationResult;
  author: ValidationResult;
  year: ValidationResult;
  fontSize: ValidationResult;
  file: ValidationResult;
  overall: ValidationResult;
}

/**
 * Custom hook for comprehensive form validation
 * Provides real-time validation feedback and user guidance
 */
export function useFormValidation() {
  const { bookInfo, pdfOptions, fileState } = useAppContext();
  const { showWarning } = useNotifications();

  const [validationState, setValidationState] = useState<FormValidationState>({
    bookName: { isValid: true },
    author: { isValid: true },
    year: { isValid: true },
    fontSize: { isValid: true },
    file: { isValid: false, error: 'Please select a file' },
    overall: { isValid: false }
  });

  // Validate individual fields
  const validateField = useCallback((field: keyof FormValidationState, value: any) => {
    let result: ValidationResult;

    switch (field) {
      case 'bookName':
        result = validateBookName(value);
        break;
      case 'author':
        result = validateAuthor(value);
        break;
      case 'year':
        result = validateYear(value);
        break;
      case 'fontSize':
        result = validateFontSize(value);
        break;
      case 'file':
        result = value ? validateFile(value) : { isValid: false, error: 'Please select a file' };
        break;
      default:
        result = { isValid: true };
    }

    setValidationState(prev => ({
      ...prev,
      [field]: result
    }));

    // Show warnings for valid but concerning inputs
    if (result.isValid && result.warning) {
      showWarning(`${field} Warning`, result.warning);
    }

    return result;
  }, [showWarning]);

  // Validate file content after reading
  const validateContent = useCallback((content: string) => {
    const result = validateFileContent(content);
    
    if (result.warning) {
      showWarning('File Content Warning', result.warning);
    }

    return result;
  }, [showWarning]);

  // Validate entire form
  const validateForm = useCallback(() => {
    const formData = {
      bookName: bookInfo.bookName,
      author: bookInfo.author,
      year: bookInfo.year,
      fontSize: pdfOptions.fontSize,
      file: fileState.fileName ? new File([''], fileState.fileName) : null
    };

    const result = validateFormData(formData);
    
    setValidationState(prev => ({
      ...prev,
      overall: result
    }));

    return result;
  }, [bookInfo, pdfOptions, fileState]);

  // Auto-validate fields when they change
  useEffect(() => {
    validateField('bookName', bookInfo.bookName);
  }, [bookInfo.bookName, validateField]);

  useEffect(() => {
    validateField('author', bookInfo.author);
  }, [bookInfo.author, validateField]);

  useEffect(() => {
    validateField('year', bookInfo.year);
  }, [bookInfo.year, validateField]);

  useEffect(() => {
    validateField('fontSize', pdfOptions.fontSize);
  }, [pdfOptions.fontSize, validateField]);

  useEffect(() => {
    const hasFile = !!fileState.fileName;
    validateField('file', hasFile ? new File([''], fileState.fileName) : null);
  }, [fileState.fileName, validateField]);

  // Update overall validation when individual fields change
  useEffect(() => {
    const isOverallValid = Object.entries(validationState)
      .filter(([key]) => key !== 'overall')
      .every(([, result]) => result.isValid);

    setValidationState(prev => ({
      ...prev,
      overall: { isValid: isOverallValid }
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationState.bookName, validationState.author, validationState.year, validationState.fontSize, validationState.file]);

  // Get validation error message with guidance
  const getFieldError = useCallback((field: keyof FormValidationState): string | undefined => {
    const result = validationState[field];
    if (!result.isValid && result.error) {
      return result.error;
    }
    return undefined;
  }, [validationState]);

  // Get validation warning message
  const getFieldWarning = useCallback((field: keyof FormValidationState): string | undefined => {
    const result = validationState[field];
    if (result.isValid && result.warning) {
      return result.warning;
    }
    return undefined;
  }, [validationState]);

  // Get user guidance for field errors
  const getFieldGuidance = useCallback((field: keyof FormValidationState): string | undefined => {
    const result = validationState[field];
    if (!result.isValid && result.error) {
      return getValidationGuidance(field, result.error);
    }
    return undefined;
  }, [validationState]);

  // Check if field has error
  const hasFieldError = useCallback((field: keyof FormValidationState): boolean => {
    return !validationState[field].isValid;
  }, [validationState]);

  // Check if field has warning
  const hasFieldWarning = useCallback((field: keyof FormValidationState): boolean => {
    const result = validationState[field];
    return result.isValid && !!result.warning;
  }, [validationState]);

  // Get all current validation errors
  const getAllErrors = useCallback((): string[] => {
    return Object.entries(validationState)
      .filter(([key, result]) => key !== 'overall' && !result.isValid && result.error)
      .map(([, result]) => result.error!);
  }, [validationState]);

  // Check if form is ready for submission
  const isFormValid = useCallback((): boolean => {
    return validationState.overall.isValid;
  }, [validationState.overall]);

  // Get reasons why form is invalid
  const getInvalidReasons = useCallback((): string[] => {
    if (isFormValid()) return [];
    
    return Object.entries(validationState)
      .filter(([key, result]) => key !== 'overall' && !result.isValid)
      .map(([key, result]) => `${key}: ${result.error}`);
  }, [validationState, isFormValid]);

  return {
    validationState,
    validateField,
    validateContent,
    validateForm,
    getFieldError,
    getFieldWarning,
    getFieldGuidance,
    hasFieldError,
    hasFieldWarning,
    getAllErrors,
    isFormValid,
    getInvalidReasons,
  };
}
