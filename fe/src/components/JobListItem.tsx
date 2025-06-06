import React from 'react';
import {
  TableRow,
  TableCell,
  Button,
  Chip,
  LinearProgress,
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  FilePresent as FileIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Job } from '../types';
import { JobManagementService } from '../services/jobManagementService';

interface JobListItemProps {
  job: Job;
  onRefresh?: (jobId: string) => void;
}

const JobListItem: React.FC<JobListItemProps> = ({ job, onRefresh }) => {
  const handleDownload = () => {
    if (job.status === 'completed') {
      const downloadUrl = JobManagementService.getDownloadUrl(job.id);
      window.open(downloadUrl, '_blank');
    }
  };

  const handleViewOriginal = () => {
    if (job.uploadPath) {
      const fileUrl = JobManagementService.getOriginalFileUrl(job.uploadPath);
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      }
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh(job.id);
    }
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'error':
        return 'error';
      case 'queued':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return 'Complete';
      case 'in_progress':
        return 'Processing';
      case 'error':
        return 'Failed';
      case 'queued':
        return 'Queued';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return '--';
    }
  };

  const progressPercentage = job.progress?.percentage || 0;
  const progressStep = job.progress?.step || 'Unknown';

  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          {job.bookName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Font: {job.fontSize}pt
        </Typography>
      </TableCell>
      
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={getStatusLabel(job.status)}
            color={getStatusColor(job.status)}
            size="small"
          />
          {(job.status === 'in_progress' || job.status === 'queued') && (
            <Tooltip title="Refresh status">
              <IconButton size="small" onClick={handleRefresh}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </TableCell>
      
      <TableCell>
        {job.status === 'in_progress' || job.status === 'queued' ? (
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" sx={{ minWidth: 35 }}>
                {progressPercentage}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{ height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {progressStep}
            </Typography>
          </Box>
        ) : job.status === 'error' ? (
          <Typography variant="caption" color="error">
            {job.progress?.errorMessage || 'Generation failed'}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            --
          </Typography>
        )}
      </TableCell>
      
      <TableCell>
        <Typography variant="caption">
          {formatDate(job.createdAt)}
        </Typography>
      </TableCell>
      
      <TableCell>
        <Typography variant="caption">
          {formatDate(job.completedAt)}
        </Typography>
      </TableCell>
      
      <TableCell>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {job.originalFileName && (
            <Tooltip title={`View original file: ${job.originalFileName}`}>
              <IconButton size="small" onClick={handleViewOriginal}>
                <FileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {job.status === 'completed' && (
            <Tooltip title="Download PDF">
              <IconButton size="small" onClick={handleDownload} color="primary">
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default JobListItem;
