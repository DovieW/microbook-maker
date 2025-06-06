import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useJobManagement } from '../hooks/useJobManagement';
import { PdfGeneratorService } from '../services/pdfGeneratorService';
import JobListItem from './JobListItem';

const JobManagement: React.FC = () => {
  const { jobs, loading, error, refreshJobs, clearError } = useJobManagement();

  const handleRefreshJob = async (jobId: string) => {
    try {
      await PdfGeneratorService.checkProgress(jobId);
      // The useJobManagement hook will handle updating the job status
    } catch (err) {
      console.error('Failed to refresh job:', err);
    }
  };

  const handleRefreshAll = () => {
    clearError();
    refreshJobs();
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          PDF Generation Jobs
        </Typography>
        <Tooltip title="Refresh all jobs">
          <IconButton onClick={handleRefreshAll} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error.message}
        </Alert>
      )}

      {jobs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No PDF generation jobs found.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Upload a text file to generate your first PDF.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Book Details
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Status
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Progress
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Created
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Completed
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Actions
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <JobListItem
                  key={job.id}
                  job={job}
                  onRefresh={handleRefreshJob}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {loading && jobs.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="caption" sx={{ ml: 1 }}>
            Updating...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default JobManagement;
