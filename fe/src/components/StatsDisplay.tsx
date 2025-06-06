import React from 'react';
import { Box } from '@mui/material';
import { useAppContext } from '../context/AppContext';
import { BoldText } from './styled';

const StatsDisplay: React.FC = () => {
  const { fileState } = useAppContext();

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      mt: 2,
      maxWidth: 600,
      width: '100%',
      px: 3
    }}>
      <BoldText color='primary' variant='body1'>
        Words: {fileState.wordCount > 0 ? new Intl.NumberFormat().format(fileState.wordCount) : '--'}
      </BoldText>
      
      <BoldText color='primary' variant='body1'>
        Sheets: {fileState.sheetsCount > 0 ? new Intl.NumberFormat().format(fileState.sheetsCount) : '--'}
      </BoldText>
      
      <BoldText color='primary' variant='body1'>
        Read Time: {fileState.readTime}
      </BoldText>
    </Box>
  );
};

export default StatsDisplay;
