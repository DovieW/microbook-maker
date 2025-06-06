import {
  validateFontSize,
  validateFile,
  validateFileContent,
  validateBookName,
  validateAuthor,
  validateYear,
  validateFormData,
  getValidationGuidance
} from '../validation';

describe('Validation Utilities', () => {
  describe('validateFontSize', () => {
    it('should validate correct font sizes', () => {
      expect(validateFontSize('6')).toEqual({ isValid: true });
      expect(validateFontSize('4')).toEqual({ isValid: true });
      expect(validateFontSize('10')).toEqual({ isValid: true });
      expect(validateFontSize('7.5')).toEqual({ isValid: true });
    });

    it('should show warnings for edge cases', () => {
      const result1 = validateFontSize('4.5');
      expect(result1.isValid).toBe(true);
      expect(result1.warning).toContain('Very small font size');

      const result2 = validateFontSize('9.5');
      expect(result2.isValid).toBe(true);
      expect(result2.warning).toContain('Large font size');
    });

    it('should reject invalid font sizes', () => {
      expect(validateFontSize('3')).toEqual({
        isValid: false,
        error: 'Font size must be at least 4'
      });

      expect(validateFontSize('11')).toEqual({
        isValid: false,
        error: 'Font size must be no more than 10'
      });

      expect(validateFontSize('abc')).toEqual({
        isValid: false,
        error: 'Font size must be a valid number'
      });

      expect(validateFontSize('')).toEqual({
        isValid: false,
        error: 'Font size is required'
      });
    });
  });

  describe('validateFile', () => {
    it('should validate correct files', () => {
      const validFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      expect(validateFile(validFile)).toEqual({ isValid: true });
    });

    it('should show warnings for edge cases', () => {
      const smallFile = new File(['x'], 'small.txt', { type: 'text/plain' });
      const result1 = validateFile(smallFile);
      expect(result1.isValid).toBe(true);
      expect(result1.warning).toContain('very small');

      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB
      const largeFile = new File([largeContent], 'large.txt', { type: 'text/plain' });
      const result2 = validateFile(largeFile);
      expect(result2.isValid).toBe(true);
      expect(result2.warning).toContain('Large file');
    });

    it('should reject invalid files', () => {
      expect(validateFile(null as any)).toEqual({
        isValid: false,
        error: 'Please select a file'
      });

      const wrongType = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      expect(validateFile(wrongType)).toEqual({
        isValid: false,
        error: 'Only .txt files are supported'
      });

      const emptyFile = new File([''], 'empty.txt', { type: 'text/plain' });
      expect(validateFile(emptyFile)).toEqual({
        isValid: false,
        error: 'File appears to be empty'
      });

      const tooLargeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const tooLargeFile = new File([tooLargeContent], 'huge.txt', { type: 'text/plain' });
      expect(validateFile(tooLargeFile)).toEqual({
        isValid: false,
        error: 'File size must be less than 10MB'
      });
    });
  });

  describe('validateFileContent', () => {
    it('should validate good content', () => {
      const goodContent = 'This is a good file with plenty of content to make a nice PDF document.';
      expect(validateFileContent(goodContent)).toEqual({ isValid: true });
    });

    it('should show warnings for short content', () => {
      const shortContent = 'Short content';
      const result = validateFileContent(shortContent);
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('very few words');

      const veryShortContent = 'Very short';
      const result2 = validateFileContent(veryShortContent);
      expect(result2.isValid).toBe(true);
      expect(result2.warning).toContain('Short content');
    });

    it('should reject empty content', () => {
      expect(validateFileContent('')).toEqual({
        isValid: false,
        error: 'File content is empty'
      });

      expect(validateFileContent('   ')).toEqual({
        isValid: false,
        error: 'File content is empty'
      });
    });
  });

  describe('validateBookName', () => {
    it('should validate good book names', () => {
      expect(validateBookName('The Great Gatsby')).toEqual({ isValid: true });
      expect(validateBookName('1984')).toEqual({ isValid: true });
    });

    it('should reject invalid book names', () => {
      expect(validateBookName('')).toEqual({
        isValid: false,
        error: 'Book name is required'
      });

      expect(validateBookName('A')).toEqual({
        isValid: false,
        error: 'Book name must be at least 2 characters'
      });

      const longName = 'x'.repeat(101);
      expect(validateBookName(longName)).toEqual({
        isValid: false,
        error: 'Book name must be less than 100 characters'
      });
    });
  });

  describe('validateAuthor', () => {
    it('should validate authors (including empty)', () => {
      expect(validateAuthor('F. Scott Fitzgerald')).toEqual({ isValid: true });
      expect(validateAuthor('')).toEqual({ isValid: true }); // Optional field
    });

    it('should reject very long author names', () => {
      const longAuthor = 'x'.repeat(101);
      expect(validateAuthor(longAuthor)).toEqual({
        isValid: false,
        error: 'Author name must be less than 100 characters'
      });
    });
  });

  describe('validateYear', () => {
    it('should validate good years', () => {
      expect(validateYear('1925')).toEqual({ isValid: true });
      expect(validateYear('2023')).toEqual({ isValid: true });
      expect(validateYear('')).toEqual({ isValid: true }); // Optional field
    });

    it('should show warnings for very old years', () => {
      const result = validateYear('1350');
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('Very old publication year');
    });

    it('should reject invalid years', () => {
      expect(validateYear('abc')).toEqual({
        isValid: false,
        error: 'Year must be a valid number'
      });

      expect(validateYear('123')).toEqual({
        isValid: false,
        error: 'Year must be a 4-digit year'
      });

      const futureYear = (new Date().getFullYear() + 15).toString();
      expect(validateYear(futureYear)).toEqual({
        isValid: false,
        error: 'Year cannot be more than 10 years in the future'
      });
    });
  });

  describe('validateFormData', () => {
    const validFormData = {
      bookName: 'Test Book',
      author: 'Test Author',
      year: '2023',
      fontSize: '6',
      file: new File(['content'], 'test.txt', { type: 'text/plain' })
    };

    it('should validate complete valid form', () => {
      expect(validateFormData(validFormData)).toEqual({ isValid: true });
    });

    it('should reject form with missing file', () => {
      const invalidData = { ...validFormData, file: null };
      expect(validateFormData(invalidData)).toEqual({
        isValid: false,
        error: 'Please select a file to upload'
      });
    });

    it('should reject form with invalid book name', () => {
      const invalidData = { ...validFormData, bookName: '' };
      expect(validateFormData(invalidData)).toEqual({
        isValid: false,
        error: 'Book name is required'
      });
    });

    it('should reject form with invalid font size', () => {
      const invalidData = { ...validFormData, fontSize: '15' };
      expect(validateFormData(invalidData)).toEqual({
        isValid: false,
        error: 'Font size must be no more than 10'
      });
    });
  });

  describe('getValidationGuidance', () => {
    it('should provide guidance for known errors', () => {
      const guidance = getValidationGuidance('fontSize', 'Font size must be between 4 and 10');
      expect(guidance).toContain('Try a font size like 6 or 8');
    });

    it('should provide default guidance for unknown errors', () => {
      const guidance = getValidationGuidance('unknown', 'Unknown error');
      expect(guidance).toBe('Please check your input and try again.');
    });
  });
});
