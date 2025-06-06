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
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error.message}
        </Alert>
      )}

      {jobs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No jobs found.
          </Typography>
        </Paper>
      ) : (
        <JobListContainer>
          {jobs.map((job) => (
            <JobListItem
              key={job.id}
              job={job}
            />
          ))}
        </JobListContainer>
      )}
    </Box>
  );
};

export default JobManagement;
