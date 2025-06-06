import React from 'react';
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
  const { jobs, loading, error, clearError } = useJobManagementContext();

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
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error.message}
        </Alert>
      )}

      {sortedJobs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No jobs found.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '544px', // Adjusted to match main card height more precisely
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.5)',
              },
            },
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
