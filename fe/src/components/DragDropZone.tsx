import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { designTokens } from '../theme';

interface DragDropZoneProps {
  isDragActive: boolean;
  isDragOver: boolean;
  children: React.ReactNode;
}

const DragDropContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isDragActive' && prop !== 'isDragOver',
})<{ isDragActive: boolean; isDragOver: boolean }>(({ theme, isDragActive, isDragOver }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  transition: 'all 0.2s ease-in-out',
  pointerEvents: 'none',
  zIndex: isDragActive ? 999 : -1,

  ...(isDragActive && {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent', // Remove background on the border
      border: `2px dashed ${alpha(theme.palette.primary.main, 0.6)}`, // More subtle border
      borderRadius: designTokens.borderRadius.xlarge,
      zIndex: 1,
      pointerEvents: 'none',
    },
  }),

  ...(isDragOver && {
    '&::before': {
      borderColor: alpha(theme.palette.primary.main, 0.8), // Slightly more visible on hover
    },
  }),
}));

const DragDropOverlay = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isDragActive',
})<{ isDragActive: boolean }>(({ theme, isDragActive }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha('#000000', 0.7), // Dark transparent background
  borderRadius: designTokens.borderRadius.xlarge,
  zIndex: 2,
  opacity: isDragActive ? 1 : 0,
  visibility: isDragActive ? 'visible' : 'hidden',
  transition: 'all 0.2s ease-in-out',
  pointerEvents: 'none',
}));

const UploadIcon = styled(CloudUploadIcon)(({ theme }) => ({
  fontSize: '3rem', // Slightly smaller
  color: theme.palette.common.white,
  marginBottom: theme.spacing(2),
  opacity: 0.9,
}));

const DragDropText = styled(Typography)(({ theme }) => ({
  color: theme.palette.common.white,
  fontFamily: theme.typography.fontFamily, // Use the existing font family
  fontWeight: theme.typography.fontWeightMedium || 500, // Less bold
  textAlign: 'center',
  marginBottom: theme.spacing(1),
  fontSize: '1.25rem', // Slightly smaller
}));

const DragDropSubtext = styled(Typography)(({ theme }) => ({
  color: alpha(theme.palette.common.white, 0.8), // Subtle white with transparency
  fontFamily: theme.typography.fontFamily, // Use the existing font family
  textAlign: 'center',
  fontSize: '0.875rem',
  fontWeight: theme.typography.fontWeightRegular || 400,
}));

const DragDropZone: React.FC<DragDropZoneProps> = ({
  isDragActive,
  isDragOver,
  children,
}) => {
  return (
    <DragDropContainer isDragActive={isDragActive} isDragOver={isDragOver}>
      {children}
      <DragDropOverlay isDragActive={isDragActive}>
        <UploadIcon />
        <DragDropText variant="h6">
          Drop your TXT file here
        </DragDropText>
        <DragDropSubtext>
          Release to upload your file
        </DragDropSubtext>
      </DragDropOverlay>
    </DragDropContainer>
  );
};

export default DragDropZone;
