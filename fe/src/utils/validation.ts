/**
 * Validation utilities for form inputs and user data
 * Provides consistent validation logic across the application
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validates font size input
 * @param value - Font size value as string
 * @returns Validation result with error/warning messages
 */
export function validateFontSize(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'Font size is required'
    };
  }

  const numValue = parseFloat(value);
  
  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: 'Font size must be a valid number'
    };
  }

  if (numValue < 4) {
    return {
      isValid: false,
      error: 'Font size must be at least 4'
    };
  }

  if (numValue > 10) {
    return {
      isValid: false,
      error: 'Font size must be no more than 10'
    };
  }

  // Warnings for edge cases
  // if (numValue < 5) {
  //   return {
  //     isValid: true,
  //     warning: 'Very small font size may be difficult to read'
  //   };
  // }

  // if (numValue > 9) {
  //   return {
  //     isValid: true,
  //     warning: 'Large font size will result in fewer words per page'
  //   };
  // }

  return { isValid: true };
}

/**
 * Validates uploaded file
 * @param file - File object to validate
 * @returns Validation result with error/warning messages
 */
export function validateFile(file: File): ValidationResult {
  if (!file) {
    return {
      isValid: false,
      error: 'Please select a file'
    };
  }

  // Check file extension
  if (!file.name.toLowerCase().endsWith('.txt')) {
    return {
      isValid: false,
      error: 'Only .txt files are supported'
    };
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size must be less than 10MB'
    };
  }

  // Check for empty file
  if (file.size === 0) {
    return {
      isValid: false,
      error: 'File appears to be empty'
    };
  }

  // Warning for very small files
  if (file.size < 1000) { // Less than 1KB
    return {
      isValid: true,
      warning: 'File is very small and may result in a short PDF'
    };
  }

  // Warning for very large files
  if (file.size > 5 * 1024 * 1024) { // More than 5MB
    return {
      isValid: true,
      warning: 'Large file may take longer to process'
    };
  }

  return { isValid: true };
}

/**
 * Validates file content after reading
 * @param content - File content as string
 * @returns Validation result with error/warning messages
 */
export function validateFileContent(content: string): ValidationResult {
  if (!content || content.trim() === '') {
    return {
      isValid: false,
      error: 'File content is empty'
    };
  }

  const wordCount = content.trim().split(/\s+/).length;

  if (wordCount === 0) {
    return {
      isValid: false,
      error: 'File contains no readable words'
    };
  }

  if (wordCount < 50) {
    return {
      isValid: true,
      warning: 'File contains very few words (less than 50)'
    };
  }

  if (wordCount < 100) {
    return {
      isValid: true,
      warning: 'Short content may result in a very brief PDF'
    };
  }

  return { isValid: true };
}

/**
 * Validates book name input
 * @param value - Book name value
 * @returns Validation result
 */
export function validateBookName(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'Book name is required'
    };
  }

  if (value.trim().length < 2) {
    return {
      isValid: false,
      error: 'Book name must be at least 2 characters'
    };
  }

  if (value.length > 100) {
    return {
      isValid: false,
      error: 'Book name must be less than 100 characters'
    };
  }

  return { isValid: true };
}

/**
 * Validates author name input
 * @param value - Author name value
 * @returns Validation result
 */
export function validateAuthor(value: string): ValidationResult {
  // Author is optional, so empty is valid
  if (!value || value.trim() === '') {
    return { isValid: true };
  }

  if (value.length > 100) {
    return {
      isValid: false,
      error: 'Author name must be less than 100 characters'
    };
  }

  return { isValid: true };
}

/**
 * Validates year input
 * @param value - Year value
 * @returns Validation result
 */
export function validateYear(value: string): ValidationResult {
  // Year is optional
  if (!value || value.trim() === '') {
    return { isValid: true };
  }

  const numValue = parseInt(value);
  
  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: 'Year must be a valid number'
    };
  }

  const currentYear = new Date().getFullYear();
  
  if (numValue < 1000) {
    return {
      isValid: false,
      error: 'Year must be a 4-digit year'
    };
  }

  if (numValue > currentYear + 10) {
    return {
      isValid: false,
      error: 'Year cannot be more than 10 years in the future'
    };
  }

  if (numValue < 1400) {
    return {
      isValid: true,
      warning: 'Very old publication year'
    };
  }

  return { isValid: true };
}

/**
 * Validates all form data for PDF generation
 * @param formData - Object containing all form values
 * @returns Overall validation result
 */
export function validateFormData(formData: {
  bookName: string;
  author: string;
  year: string;
  fontSize: string;
  file: File | null;
}): ValidationResult {
  const bookNameResult = validateBookName(formData.bookName);
  if (!bookNameResult.isValid) {
    return bookNameResult;
  }

  const authorResult = validateAuthor(formData.author);
  if (!authorResult.isValid) {
    return authorResult;
  }

  const yearResult = validateYear(formData.year);
  if (!yearResult.isValid) {
    return yearResult;
  }

  const fontSizeResult = validateFontSize(formData.fontSize);
  if (!fontSizeResult.isValid) {
    return fontSizeResult;
  }

  if (!formData.file) {
    return {
      isValid: false,
      error: 'Please select a file to upload'
    };
  }

  const fileResult = validateFile(formData.file);
  if (!fileResult.isValid) {
    return fileResult;
  }

  return { isValid: true };
}

/**
 * Gets user-friendly error message for common validation scenarios
 * @param field - Field name that failed validation
 * @param error - Error message
 * @returns User-friendly error message with suggestions
 */
export function getValidationGuidance(field: string, error: string): string {
  const guidance: Record<string, Record<string, string>> = {
    fontSize: {
      'Font size must be between 4 and 10': 'Try a font size like 6 or 8 for optimal readability.',
      'Font size must be a valid number': 'Enter a number between 4 and 10.',
    },
    file: {
      'Only .txt files are supported': 'Convert your document to a plain text (.txt) file first.',
      'File size must be less than 10MB': 'Try splitting large documents into smaller files.',
      'File appears to be empty': 'Make sure your text file contains content.',
    },
    bookName: {
      'Book name is required': 'Enter the title of your book or document.',
      'Book name must be at least 2 characters': 'Enter a longer title.',
    }
  };

  return guidance[field]?.[error] || 'Please check your input and try again.';
}
