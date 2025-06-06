import React from 'react';
import {
  Typography,
  IconButton,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  FilePresent as FileIcon,
} from '@mui/icons-material';
import { Job } from '../types';
import { JobManagementService } from '../services/jobManagementService';
import {
  JobListItem as StyledJobListItem,
  JobItemContent,
  JobItemActions,
  JobProgressBar,
} from './styled';

interface JobListItemProps {
  job: Job;
}

const JobListItem: React.FC<JobListItemProps> = ({ job }) => {
  const handleDownload = () => {
    if (job.status === 'completed') {
      const downloadUrl = JobManagementService.getDownloadUrl(job.id);
      window.open(downloadUrl, '_blank');
    }
  };

  const handleDownloadOriginal = () => {
    if (job.uploadPath) {
      const fileUrl = JobManagementService.getOriginalFileUrl(job.uploadPath);
      if (fileUrl) {
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = job.originalFileName || 'uploaded-file.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  // Calculate progress percentage for loading bar
  const progressPercentage = job.progress?.percentage || 0;
  const isGenerating = job.status === 'in_progress' || job.status === 'queued';

  return (
    <Fade in={true} timeout={300}>
      <StyledJobListItem>
        <JobItemContent>
          <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
            {job.bookName}
          </Typography>
        </JobItemContent>

        <JobItemActions>
          {job.uploadPath && (
            <Tooltip title={`Download original file: ${job.originalFileName || 'uploaded file'}`}>
              <IconButton size="small" onClick={handleDownloadOriginal}>
                <FileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Open PDF">
            <IconButton
              size="small"
              onClick={handleDownload}
              color="primary"
              disabled={job.status !== 'completed'}
              sx={{
                opacity: job.status === 'completed' ? 1 : 0.3,
                transition: 'opacity 0.2s ease-in-out'
              }}
            >
              <PdfIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </JobItemActions>

        {/* Progress bar at bottom during generation */}
        {isGenerating && (
          <JobProgressBar
            variant="determinate"
            value={progressPercentage}
          />
        )}
      </StyledJobListItem>
    </Fade>
  );
};

export default JobListItem;
