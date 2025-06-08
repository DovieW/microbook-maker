import React, { useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useJobManagementContext } from '../context/JobManagementContext';
import JobListItem from './JobListItem';
import { JobListContainer } from './styled';

const JobManagement: React.FC = () => {
  const { jobs, loading, error, clearError, onScrollToTop } = useJobManagementContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Set up scroll to top functionality
  useEffect(() => {
    const scrollToTop = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    };

    onScrollToTop(scrollToTop);
  }, [onScrollToTop]);

  // Sort jobs by creation date (newest first) to ensure consistent ordering
  const sortedJobs = React.useMemo(() => {
    return [...jobs].sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [jobs]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2, color: 'primary.main' }}>
          Loading jobs...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: 0, // Important for flex child to shrink properly
    }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }} onClose={clearError}>
          {error.message}
        </Alert>
      )}

      {sortedJobs.length === 0 ? (
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 1,
        }}>
          <Typography variant="body1" color="text.secondary">
            No jobs found.
          </Typography>
        </Box>
      ) : (
        <Box sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0, // Important for proper flex behavior
        }}>
          <Box
            ref={scrollContainerRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0, // Allow shrinking
              // Hide scrollbar
              '&::-webkit-scrollbar': {
                display: 'none',
              },
              // Hide scrollbar for Firefox
              scrollbarWidth: 'none',
            }}>
            <JobListContainer>
              {sortedJobs.map((job) => (
                <JobListItem
                  key={job.id}
                  job={job}
                />
              ))}
            </JobListContainer>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default JobManagement;
