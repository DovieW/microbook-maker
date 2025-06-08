import React, { useState } from 'react';
import {
  Typography,
  IconButton,
  Tooltip,
  Fade,
  Button,
} from '@mui/material';
import {
  FilePresent as FileIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PictureAsPdf as PdfIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { Job } from '../types';
import { JobManagementService } from '../services/jobManagementService';
import { PdfGeneratorService } from '../services/pdfGeneratorService';
import { useJobManagementContext } from '../context/JobManagementContext';
import { useFileHandling } from '../hooks/useFileHandling';
import {
  JobListItem as StyledJobListItem,
  JobItemHeader,
  JobItemContent,
  JobItemActions,
  JobExpandedContent,
  JobDetailsContainer,
  JobDetailRow,
  JobActionButtons,
  JobProgressBar,
} from './styled';

interface JobListItemProps {
  job: Job;
}

const JobListItem: React.FC<JobListItemProps> = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const { deleteJob } = useJobManagementContext();
  const { loadFileFromJob } = useFileHandling();

  // Auto-expand when job starts generating (only once)
  const isGenerating = job.status === 'in_progress' || job.status === 'queued';
  React.useEffect(() => {
    if (isGenerating && !hasAutoExpanded) {
      setExpanded(true);
      setHasAutoExpanded(true);
    }
  }, [isGenerating, hasAutoExpanded]);

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
  };

  const handleDownloadOriginal = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding when clicking action button

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

  const handleDeleteJob = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding when clicking action button

    if (deleting) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${job.bookName}"? This will permanently remove the job, PDF, and original upload file.`
    );

    if (confirmDelete) {
      setDeleting(true);
      try {
        await deleteJob(job.id);
      } catch (error) {
        console.error('Failed to delete job:', error);
        // Error is already handled by the hook and displayed in the UI
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleShowPdf = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding when clicking action button

    if (job.status === 'completed') {
      const pdfUrl = PdfGeneratorService.getDownloadUrl(job.id);
      window.open(pdfUrl, '_blank');
    }
  };

  const handleLoadFile = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding when clicking action button

    if (loadingFile) return;

    setLoadingFile(true);
    try {
      await loadFileFromJob(job);
    } catch (error) {
      console.error('Failed to load file:', error);
      // Error is already handled by the hook and displayed in the UI
    } finally {
      setLoadingFile(false);
    }
  };

  // Calculate progress percentage for loading bar
  const progressPercentage = job.progress?.percentage || 0;

  // Format dates for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };





  return (
    <Fade in={true} timeout={300}>
      <StyledJobListItem>
        <JobItemHeader onClick={handleToggleExpanded}>
          <JobItemContent>
            <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
              {job.bookName}
            </Typography>
          </JobItemContent>

          <JobItemActions>
            <IconButton size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </JobItemActions>
        </JobItemHeader>

        <JobExpandedContent expanded={expanded}>
          <JobDetailsContainer>
            <JobDetailRow>
              <Typography variant="body2" color="text.secondary">
                Font Size:
              </Typography>
              <Typography variant="body2">
                {job.fontSize}px
              </Typography>
            </JobDetailRow>

            {job.borderStyle && (
              <JobDetailRow>
                <Typography variant="body2" color="text.secondary">
                  Border Style:
                </Typography>
                <Typography variant="body2">
                  {job.borderStyle}
                </Typography>
              </JobDetailRow>
            )}

            {job.author && (
              <JobDetailRow>
                <Typography variant="body2" color="text.secondary">
                  Author:
                </Typography>
                <Typography variant="body2">
                  {job.author}
                </Typography>
              </JobDetailRow>
            )}

            {job.year && (
              <JobDetailRow>
                <Typography variant="body2" color="text.secondary">
                  Year:
                </Typography>
                <Typography variant="body2">
                  {job.year}
                </Typography>
              </JobDetailRow>
            )}

            {job.series && (
              <JobDetailRow>
                <Typography variant="body2" color="text.secondary">
                  Series:
                </Typography>
                <Typography variant="body2">
                  {job.series}
                </Typography>
              </JobDetailRow>
            )}

            <JobDetailRow>
              <Typography variant="body2" color="text.secondary">
                Created:
              </Typography>
              <Typography variant="body2">
                {formatDate(job.createdAt)}
              </Typography>
            </JobDetailRow>

            <JobActionButtons>
              {/* Left side buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Tooltip title="Delete job">
                  <IconButton
                    size="small"
                    onClick={handleDeleteJob}
                    color="error"
                    disabled={deleting}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>

                {job.uploadPath && (
                  <Tooltip title={`Download original file: ${job.originalFileName || 'uploaded file'}`}>
                    <IconButton
                      size="small"
                      onClick={handleDownloadOriginal}
                      color="primary"
                    >
                      <FileIcon />
                    </IconButton>
                  </Tooltip>
                )}

                {job.uploadPath && job.originalFileName && (
                  <Tooltip title={`Load ${job.originalFileName}`}>
                    <IconButton
                      size="small"
                      onClick={handleLoadFile}
                      color="primary"
                      disabled={loadingFile}
                    >
                      <UploadIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </div>

              {/* Right side button */}
              {job.status === 'completed' ? (
                <Button
                  size="small"
                  onClick={handleShowPdf}
                  color="primary"
                  variant="outlined"
                  startIcon={<PdfIcon />}
                >
                  Open PDF
                </Button>
              ) : isGenerating ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontStyle: 'italic',
                    opacity: 0.7,
                    alignSelf: 'center'
                  }}
                >
                  {progressPercentage}% complete...
                </Typography>
              ) : null}
            </JobActionButtons>
          </JobDetailsContainer>
        </JobExpandedContent>

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
