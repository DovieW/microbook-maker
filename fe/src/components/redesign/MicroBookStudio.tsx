import React, { useEffect, useMemo, useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Download,
  Info,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scissors,
  Settings2,
  Trash2,
  Type,
  UploadCloud,
  X,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useJobManagementContext } from '../../context/JobManagementContext';
import { useFileHandling } from '../../hooks/useFileHandling';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useNotifications } from '../../hooks/useNotifications';
import { Job } from '../../types';
import { validateFontSize } from '../../utils/validation';
import { JobManagementService } from '../../services/jobManagementService';
import {
  Badge,
  Button,
  Field,
  HelpText,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from '../../ui';
import { cn } from '../../lib/cn';

const numberFormatter = new Intl.NumberFormat();

function formatDate(value: string | null) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function formatCompactReadTime(value: string | null | undefined) {
  if (!value || value === '--') return '--';

  const hoursMatch = value.match(/(\d+)\s*hour/i);
  const minutesMatch = value.match(/(\d+)\s*minute/i);
  const parts: string[] = [];

  if (hoursMatch) {
    const hours = Number(hoursMatch[1]);
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
  }

  if (minutesMatch) {
    const minutes = Number(minutesMatch[1]);
    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes}m`);
    }
  }

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return value
    .replace(/hours?/gi, 'h')
    .replace(/minutes?/gi, 'm')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExtension(fileName: string) {
  const extension = fileName.split('.').pop();
  return extension ? extension.toUpperCase() : 'TXT';
}

function getStatusLabel(status: Job['status']) {
  switch (status) {
    case 'in_progress':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'queued':
      return 'Queued';
    case 'error':
      return 'Failed';
    default:
      return status;
  }
}

function getStatusTone(status: Job['status']): 'success' | 'brass' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'brass';
    case 'queued':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'neutral';
  }
}

function HeroIntroPanel() {
  return (
    <aside className="relative min-h-full overflow-hidden border-b border-ink/15 bg-paper-warm px-8 py-8 [container-type:inline-size] lg:border-b-0 lg:border-r xl:px-10">
      <div className="max-w-sm pt-2">
        <h1
          aria-label="MicroBook Maker"
          className="font-display text-[clamp(4rem,18cqw,5.65rem)] font-medium leading-[0.87] tracking-[-0.06em] text-ink"
        >
          <span aria-hidden="true">
            MicroBook
            <br />
            Maker
          </span>
        </h1>
        <p className="mt-5 font-display text-2xl italic leading-none text-[#d73524]">
          Small books, ready for print.
        </p>
        <div className="mt-7 h-px w-40 bg-[#d73524]" />
        <p className="mt-7 max-w-[17rem] text-sm leading-7 text-ink/75">
          Convert TXT and Markdown files into printable PDF microbooks with professional layouts,
          fold guides, and print-ready precision.
        </p>
      </div>
    </aside>
  );
}

function BookDetailsPanel() {
  const {
    bookInfo,
    setBookName,
    setAuthor,
    setSeries,
    setYear,
    fetchBookInfo,
    bookInfoLoading,
  } = useAppContext();

  const handleRefresh = () => {
    if (bookInfo.bookName) {
      fetchBookInfo(bookInfo.bookName);
    }
  };

  return (
    <section aria-labelledby="book-details-heading" className="space-y-5">
      <div className="flex items-center gap-4">
        <h2 id="book-details-heading" className="text-xs font-semibold uppercase tracking-[0.26em] text-ink">
          Book Details
        </h2>
        <div className="h-px flex-1 bg-ink/20" />
        <Tooltip content="Reload book info from OpenLibrary">
          <Button
            aria-label="Reload book info"
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={!bookInfo.bookName || bookInfoLoading}
            className="h-8 w-8 text-ink/65 hover:bg-ink/5 hover:text-[#d73524]"
          >
            <RefreshCw className={cn('h-4 w-4', bookInfoLoading && 'animate-spin')} data-testid="RefreshIcon" />
          </Button>
        </Tooltip>
      </div>

      <Field>
        <Label htmlFor="book-name" className="text-ink/80">Book Name</Label>
        <Input
          id="book-name"
          value={bookInfo.bookName}
          onChange={(event) => setBookName(event.target.value)}
          tone="paper"
          className="border-ink/30 bg-transparent font-display text-lg"
        />
      </Field>

      <Field>
        <Label htmlFor="series-name" className="text-ink/80">Series / Book Number</Label>
        <Input
          id="series-name"
          value={bookInfo.series}
          onChange={(event) => setSeries(event.target.value)}
          tone="paper"
          placeholder="Optional series, volume, or edition"
          className="border-ink/30 bg-transparent"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <Field>
          <Label htmlFor="author" className="text-ink/80">Author</Label>
          <Input
            id="author"
            value={bookInfo.author}
            onChange={(event) => setAuthor(event.target.value)}
            tone="paper"
            className="border-ink/30 bg-transparent"
          />
        </Field>

        <Field>
          <Label htmlFor="year" className="text-ink/80">Year</Label>
          <Input
            id="year"
            value={bookInfo.year}
            onChange={(event) => setYear(event.target.value)}
            type="number"
            tone="paper"
            className="border-ink/30 bg-transparent"
          />
        </Field>
      </div>
    </section>
  );
}

function PdfSettingsPanel() {
  const {
    pdfOptions,
    setBorderStyle,
    setFontFamily,
    setFoldGaps,
    capabilities,
  } = useAppContext();
  const { handleFontSizeChange } = useFileHandling();
  const fontSizeValidation = validateFontSize(pdfOptions.fontSize);

  return (
    <section aria-labelledby="settings-heading" className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 id="settings-heading" className="text-xs font-semibold uppercase tracking-[0.26em] text-ink">
          Settings
        </h2>
        <div className="h-px flex-1 bg-ink/20" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <Label htmlFor="font-size" className="text-ink/80">Font Size</Label>
          <Input
            id="font-size"
            type="number"
            min={4}
            max={10}
            step={0.5}
            value={pdfOptions.fontSize}
            onChange={(event) => handleFontSizeChange(event.target.value)}
            tone="paper"
            className={cn('border-ink/30 bg-transparent', !fontSizeValidation.isValid && 'border-[#d73524]')}
          />
          {!fontSizeValidation.isValid && (
            <HelpText className="text-[#d73524]">{fontSizeValidation.error}</HelpText>
          )}
        </Field>

        <Field>
          <Label htmlFor="font-family" className="text-ink/80">Font</Label>
          <Select value={pdfOptions.fontFamily} onValueChange={setFontFamily}>
            <SelectTrigger id="font-family" className="border-ink/30 bg-transparent text-ink">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent>
              {capabilities.fontOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <Label htmlFor="border-style" className="text-ink/80">Border Style</Label>
          <Select value={pdfOptions.borderStyle} onValueChange={setBorderStyle}>
            <SelectTrigger id="border-style" className="border-ink/30 bg-transparent text-ink">
              <SelectValue placeholder="Border style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-ink/75">
        <div className="flex items-center gap-3">
          <Switch id="fold-gaps" checked={pdfOptions.foldGaps} onCheckedChange={setFoldGaps} className="data-[state=checked]:bg-[#d73524]" />
          <Label htmlFor="fold-gaps" className="cursor-pointer normal-case tracking-normal text-ink">
            Fold gaps
          </Label>
          <span>{pdfOptions.foldGaps ? 'On' : 'Off'}</span>
        </div>
        <span className="font-display italic text-ink/45">Add space at fold lines for easier folding and better durability.</span>
      </div>
    </section>
  );
}

function SourceFilePanel({ onJobStarted }: { onJobStarted?: () => void }) {
  const { fileState, pdfOptions, capabilities, generationState } = useAppContext();
  const { uploadRef, handleFileChange, createHandleUploadFile } = useFileHandling();
  const handleUploadFile = createHandleUploadFile(onJobStarted);
  const fontSizeValidation = validateFontSize(pdfOptions.fontSize);
  const acceptedFormats = capabilities.acceptedFormats.join(', ');
  const hasFile = Boolean(fileState.fileName);
  const disabledReason = !hasFile
    ? `Please select a supported file first (${acceptedFormats})`
    : !fontSizeValidation.isValid
      ? fontSizeValidation.error || 'Please enter a valid font size (4-10)'
      : '';

  const generateButton = (
    <Button
      type="button"
      disabled={fileState.disableUpload || generationState.loading}
      onClick={handleUploadFile}
      className="h-14 w-full rounded-[0.35rem] bg-[#d73524] font-display text-xl font-semibold text-paper-warm shadow-[0_12px_28px_rgba(215,53,36,0.22)] transition-colors duration-200 hover:bg-[#cf4a3a]"
    >
      {generationState.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpen className="h-5 w-5" />}
      Generate MicroBook
      <ArrowRight className="ml-auto h-5 w-5" />
    </Button>
  );

  return (
    <section aria-labelledby="source-file-heading" className="space-y-5">
      <div className="flex items-center gap-4">
        <h2 id="source-file-heading" className="text-xs font-semibold uppercase tracking-[0.26em] text-ink">
          Source File
        </h2>
        <div className="h-px flex-1 bg-ink/20" />
      </div>

      <div className="flex flex-col gap-4 border border-dashed border-ink/35 bg-paper-warm/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          ref={uploadRef}
          id="source-file-input"
          type="file"
          accept={acceptedFormats}
          onChange={handleFileChange}
          className="sr-only"
        />
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-12 w-10 shrink-0 place-items-center border border-ink/35 bg-paper font-mono text-[0.65rem] font-bold text-ink">
            {fileState.fileName ? getExtension(fileState.fileName) : 'TXT'}
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-semibold text-ink">
              {fileState.fileName || 'No source file selected'}
            </div>
            <p className="text-xs text-ink/55">
              {fileState.fileName
                ? `${numberFormatter.format(fileState.wordCount)} words • ${getExtension(fileState.fileName)} file`
                : `Supports ${acceptedFormats || '.txt, .md, .markdown'}`}
            </p>
          </div>
        </div>
        <Button asChild variant="paper" className="border-ink/40 bg-transparent">
          <label htmlFor="source-file-input" className="cursor-pointer">
            {fileState.fileName ? 'Replace File' : 'Select File'}
          </label>
        </Button>
      </div>

      {disabledReason ? (
        <Tooltip content={disabledReason}>
          <span className="block">{generateButton}</span>
        </Tooltip>
      ) : generateButton}
    </section>
  );
}

function StatsBar() {
  const { fileState } = useAppContext();
  const stats = [
    {
      icon: Type,
      label: 'Words',
      value: fileState.wordCount > 0 ? numberFormatter.format(fileState.wordCount) : '--',
      screenReaderValue: fileState.wordCount > 0 ? numberFormatter.format(fileState.wordCount) : '--',
    },
    {
      icon: Layers3,
      label: 'Sheets',
      value: fileState.sheetsCount > 0 ? numberFormatter.format(fileState.sheetsCount) : '--',
      screenReaderValue: fileState.sheetsCount > 0 ? numberFormatter.format(fileState.sheetsCount) : '--',
    },
    {
      icon: Clock3,
      label: 'Read Time',
      value: formatCompactReadTime(fileState.readTime),
      screenReaderValue: fileState.readTime || '--',
    },
  ];

  return (
    <div className="grid gap-0 sm:grid-cols-3">
      {stats.map(({ icon: Icon, label, value, screenReaderValue }, index) => (
        <div key={label} className={cn('grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-4 px-4 py-4 text-center', index > 0 && 'sm:border-l sm:border-ink/15')}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/5 text-ink/55">
            <Icon className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-[clamp(2rem,3vw,2.5rem)] leading-[0.95] text-ink">{value}</div>
            <div className="mt-1 text-sm text-ink/60">{label}</div>
            <span className="sr-only">{label}: {screenReaderValue}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentPdfThumbnail() {
  return (
    <div className="grid h-16 w-12 shrink-0 place-items-center border border-ink/20 bg-paper-warm shadow-[0_5px_10px_rgba(35,31,27,0.08)]">
      <div className="m-1.5 flex h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)] flex-col items-center justify-center border border-dashed border-ink/20">
        <span className="h-px w-5 bg-ink/25" />
        <span className="mt-1 h-px w-4 bg-ink/20" />
        <span className="mt-1 h-px w-5 bg-ink/15" />
      </div>
    </div>
  );
}

function RecentPdfRow({ job }: { job: Job }) {
  const { deleteJob } = useJobManagementContext();
  const { loadFileFromJob } = useFileHandling();
  const statusTone = getStatusTone(job.status);
  const isDownloadable = job.status === 'completed';
  const title = job.bookName || 'Untitled MicroBook';
  const sourceLabel = job.series || job.originalFileName || 'MicroBook PDF';
  const metadata = [
    { label: 'Font', value: job.fontSize || '—' },
    { label: 'Typeface', value: job.fontFamily || 'Default' },
    { label: 'Fold gaps', value: job.foldGaps ? 'Used' : 'Off' },
  ];

  const handleDownload = () => {
    if (isDownloadable) {
      window.open(JobManagementService.getDownloadUrl(job.id), '_blank');
    }
  };

  return (
    <article className="group border border-ink/15 bg-paper-warm/45 p-4 shadow-[0_10px_28px_rgba(35,31,27,0.05)] transition hover:border-ink/25 hover:bg-paper-warm/65">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
          <span className={cn('h-1.5 w-1.5 rounded-full', statusTone === 'success' ? 'bg-success' : statusTone === 'warning' ? 'bg-warning' : statusTone === 'danger' ? 'bg-danger' : 'bg-brass')} aria-hidden="true" />
          {getStatusLabel(job.status)}
        </div>
        <time className="min-w-0 text-right text-[0.68rem] leading-4 text-ink/55" dateTime={job.createdAt || undefined}>
          {formatDate(job.createdAt)}
        </time>
      </div>

      <div className="mt-4 flex min-w-0 gap-3">
        <RecentPdfThumbnail />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl font-semibold leading-6 text-ink" title={title}>{title}</h3>
          <p className="mt-1 truncate text-xs text-ink/55" title={sourceLabel}>{sourceLabel}</p>
        </div>
      </div>

      {job.status === 'in_progress' && job.progress && (
        <Progress className="mt-4 h-1.5 bg-ink/10" value={job.progress.percentage} />
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {metadata.map((item) => (
          <div key={item.label} className="min-w-0 border border-ink/10 bg-paper/45 px-2 py-1.5">
            <dt className="truncate text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-ink/45">{item.label}</dt>
            <dd className="mt-1 truncate text-xs text-ink/75" title={String(item.value)}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="paper" size="sm" onClick={handleDownload} disabled={!isDownloadable} className="min-w-[7rem] flex-1 justify-center whitespace-nowrap border-ink/35 bg-transparent text-ink">
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        {job.uploadPath && (
          <Button variant="ghost" size="sm" onClick={() => loadFileFromJob(job)} className="whitespace-nowrap text-ink/60 hover:bg-ink/5 hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" />
            Reuse
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => deleteJob(job.id)} className="whitespace-nowrap text-ink/45 hover:bg-[#d73524]/10 hover:text-[#d73524]">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </article>
  );
}

function HistoryPanel() {
  const { jobs, loading, error, clearError, refreshJobs, onScrollToTop } = useJobManagementContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [jobs]);

  const filteredJobs = {
    all: sortedJobs,
    completed: sortedJobs.filter((job) => job.status === 'completed'),
    processing: sortedJobs.filter((job) => job.status === 'in_progress'),
    queued: sortedJobs.filter((job) => job.status === 'queued'),
  };

  useEffect(() => {
    onScrollToTop(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [onScrollToTop]);

  const renderList = (items: Job[]) => {
    if (loading) {
      return (
        <div className="space-y-4 border-t border-ink/15 pt-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="animate-pulse border border-ink/10 bg-paper-warm/45 p-4">
              <div className="mb-4 flex justify-between gap-3">
                <div className="h-5 w-24 bg-ink/10" />
                <div className="h-3 w-20 bg-ink/10" />
              </div>
              <div className="flex gap-3">
                <div className="h-16 w-12 bg-ink/10" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-2/3 bg-ink/10" />
                  <div className="h-3 w-1/2 bg-ink/10" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="h-4 w-2/3 bg-ink/10" />
                <div className="h-4 w-2/3 bg-ink/10" />
                <div className="h-4 w-2/3 bg-ink/10" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-5 border border-[#d73524]/25 bg-[#d73524]/5 p-4 text-sm text-ink">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d73524]" />
            <div>
              <p className="font-semibold">History could not be loaded.</p>
              <p className="mt-1 text-ink/60">{error.message}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="paper" size="sm" onClick={refreshJobs} className="border-ink/35 bg-transparent text-ink">Retry</Button>
                <Button variant="ghost" size="sm" onClick={clearError} className="text-ink/60 hover:bg-ink/5">Dismiss</Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="mt-5 grid min-h-[16rem] place-items-center border border-dashed border-ink/20 p-6 text-center">
          <div className="max-w-xs">
            <p className="font-display text-xl text-ink">No history yet.</p>
            <p className="mt-2 text-sm leading-6 text-ink/60">Generate a microbook and it will appear in this production history.</p>
          </div>
        </div>
      );
    }

    return (
      <div ref={scrollContainerRef} className="grid max-h-[calc(100vh-12rem)] gap-3 overflow-y-auto pr-1 [scrollbar-color:rgba(35,31,27,0.25)_transparent] [scrollbar-width:thin] md:grid-cols-2 2xl:block 2xl:space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-ink/20 [&::-webkit-scrollbar-track]:bg-transparent">
        {items.map((job) => <RecentPdfRow key={job.id} job={job} />)}
      </div>
    );
  };

  return (
    <aside className="min-w-0 border-t border-ink/15 bg-paper-aged/50 px-8 py-8 lg:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0 xl:px-10">
      <h2 className="text-lg font-semibold uppercase tracking-[0.22em] text-ink">History</h2>

      <Tabs defaultValue="all" className="mt-7">
        <TabsList className="flex w-full gap-5 overflow-x-auto border-ink/15 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="all" className="shrink-0 px-0 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink/55 hover:text-ink data-[state=active]:text-[#d73524] data-[state=active]:after:bg-[#d73524]">All</TabsTrigger>
          <TabsTrigger value="completed" className="shrink-0 px-0 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink/55 hover:text-ink data-[state=active]:text-[#d73524] data-[state=active]:after:bg-[#d73524]">Done</TabsTrigger>
          <TabsTrigger value="processing" className="shrink-0 px-0 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink/55 hover:text-ink data-[state=active]:text-[#d73524] data-[state=active]:after:bg-[#d73524]">Active</TabsTrigger>
          <TabsTrigger value="queued" className="shrink-0 px-0 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink/55 hover:text-ink data-[state=active]:text-[#d73524] data-[state=active]:after:bg-[#d73524]">Queued</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">{renderList(filteredJobs.all)}</TabsContent>
        <TabsContent value="completed" className="mt-4">{renderList(filteredJobs.completed)}</TabsContent>
        <TabsContent value="processing" className="mt-4">{renderList(filteredJobs.processing)}</TabsContent>
        <TabsContent value="queued" className="mt-4">{renderList(filteredJobs.queued)}</TabsContent>
      </Tabs>
    </aside>
  );
}

function StudioNotifications() {
  const { generationState, removeNotification } = useAppContext();

  useEffect(() => {
    const timers = generationState.notifications
      .filter((notification) => notification.autoHide !== false)
      .map((notification) => window.setTimeout(() => removeNotification(notification.id), notification.duration || 5000));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [generationState.notifications, removeNotification]);

  if (generationState.notifications.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-3">
      {generationState.notifications.map((notification) => (
        <div key={notification.id} className="border border-ink/15 bg-paper-warm p-4 text-sm text-ink shadow-[0_18px_45px_rgba(35,31,27,0.16)]">
          <div className="flex gap-3">
            <Badge variant={notification.type === 'success' ? 'success' : notification.type === 'warning' ? 'warning' : notification.type === 'error' ? 'danger' : 'brass'}>
              {notification.type}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{notification.title}</p>
              {notification.message && <p className="mt-1 leading-5 text-ink/65">{notification.message}</p>}
            </div>
            <button type="button" aria-label="Close notification" onClick={() => removeNotification(notification.id)} className="text-ink/45 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StudioDragOverlay({ isDragActive, isDragOver }: { isDragActive: boolean; isDragOver: boolean }) {
  if (!isDragActive) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-paper-warm/80 p-8 backdrop-blur-sm">
      <div className={cn('grid max-w-md place-items-center border-2 border-dashed bg-paper p-12 text-center shadow-[0_24px_70px_rgba(35,31,27,0.18)] transition', isDragOver ? 'border-[#d73524]' : 'border-ink/25')}>
        <UploadCloud className="h-12 w-12 text-[#d73524]" strokeWidth={1.5} />
        <p className="mt-5 font-display text-3xl text-ink">Drop your source file here</p>
        <p className="mt-2 text-sm leading-6 text-ink/60">Release to prepare the microbook metadata and print statistics.</p>
      </div>
    </div>
  );
}

function ProductionWorkspace({ onJobStarted }: { onJobStarted?: () => void }) {
  return (
    <main className="bg-paper px-8 py-8 xl:px-10">
      <div className="mx-auto max-w-2xl space-y-7">
        <BookDetailsPanel />
        <PdfSettingsPanel />
        <SourceFilePanel onJobStarted={onJobStarted} />
        <StatsBar />
      </div>
    </main>
  );
}

export default function MicroBookStudio() {
  const { capabilities } = useAppContext();
  const { handleFileDrop } = useFileHandling();
  const { showError } = useNotifications();
  const dragDropRef = useRef<HTMLDivElement>(null);

  const { isDragActive, isDragOver, bindDragEvents } = useDragAndDrop({
    onFileDrop: handleFileDrop,
    acceptedFileTypes: capabilities.acceptedFormats,
    maxFileSize: capabilities.maxUploadSizeBytes,
    onError: (error) => showError('Drag & Drop Error', error),
  });

  useEffect(() => {
    const cleanup = bindDragEvents(dragDropRef.current);
    return cleanup;
  }, [bindDragEvents]);

  return (
    <div ref={dragDropRef} className="min-h-screen bg-paper text-ink">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(28rem,1.05fr)] 2xl:grid-cols-[minmax(21rem,0.68fr)_minmax(34rem,1fr)_minmax(30rem,0.84fr)]">
        <HeroIntroPanel />
        <ProductionWorkspace onJobStarted={() => undefined} />
        <HistoryPanel />
      </div>
      <StudioDragOverlay isDragActive={isDragActive} isDragOver={isDragOver} />
      <StudioNotifications />
    </div>
  );
}
