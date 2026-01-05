# Next.js Langfuse Evals UI

A generic evaluation UI for [Langfuse](https://langfuse.com) that runs on [Inngest](https://inngest.com) using your own LLM provider API keys (OpenAI, Google Gemini).

## Features

- 🎯 **Prompt Management**: Browse, view, and manage your Langfuse prompts with a hierarchical folder structure
- 🔬 **Draft & Eval**: Test prompt variations against historical traces with side-by-side comparisons
- 📊 **Usage Statistics**: View prompt usage stats and trace data
- 🤖 **Provider Support**: Run evals with OpenAI or Google Gemini models
- 🔧 **Tool-Calling Support**: Automatic detection and support for prompts that use function calling
- 🧠 **Fine-tuning**: Convert Langfuse traces to OpenAI fine-tuning format and start training jobs
- ⚙️ **Structured Outputs**: Schema validation with automatic extraction from observation metadata

## Prerequisites

- Node.js 18+ and pnpm (or npm/yarn)
- A [Langfuse](https://langfuse.com) account and project
- [Inngest](https://inngest.com) account (free tier works)
- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob) or compatible storage
- API keys for your chosen LLM providers (OpenAI and/or Google Gemini)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd next-lang-evals
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Langfuse Configuration
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com

# 🔴 REQUIRED: Your Langfuse Project ID
# Find this in your Langfuse project URL
# Example: https://us.cloud.langfuse.com/project/abc123def456/prompts
#          Your project ID is: abc123def456
NEXT_PUBLIC_LANGFUSE_PROJECT_ID=your-project-id-here

NEXT_PUBLIC_LANGFUSE_BASE_URL=https://us.cloud.langfuse.com

# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Google Gemini Configuration (optional)
GOOGLE_API_KEY=...

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Inngest Configuration
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

### 3. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

Navigate to [http://localhost:3000/evals](http://localhost:3000/evals) to start working with your prompts.

## Finding Your Langfuse Project ID

1. Log into your Langfuse account at https://cloud.langfuse.com
2. Navigate to any page in your project (e.g., Prompts, Traces, etc.)
3. Look at the URL in your browser address bar
4. The project ID is the string after `/project/`

Example URL:
```
https://us.cloud.langfuse.com/project/cme8s6dl501fbad07hhojh4r6/prompts
                                     ^^^^^^^^^^^^^^^^^^^^^^^^
                                     This is your project ID
```

## Usage

### Viewing Prompts

1. Navigate to `/evals` to see all your Langfuse prompts
2. Prompts are organized in a folder hierarchy based on their names (e.g., `workflow/intake-acceptance-criteria`)
3. Click on any prompt to view its details, usage stats, and run evaluations

### Running Evaluations

1. Open a prompt and click the "Draft & Eval" tab
2. Edit the prompt template to create a variation
3. Select historical traces to test against
4. Choose your model provider (OpenAI or Gemini) and model
5. Click "Run Eval" to see side-by-side comparisons

### Fine-tuning Models

1. Navigate to `/evals/finetune`
2. Select a prompt to pull training data from Langfuse traces
3. Review and validate the generated training examples
4. Save to blob storage and start an OpenAI fine-tuning job

## Architecture

- **Frontend**: Next.js 15 App Router with React Server Components
- **Styling**: Tailwind CSS with shadcn/ui components
- **Background Jobs**: Inngest for async eval execution
- **Observability**: Langfuse for prompt management and trace tracking
- **Storage**: Vercel Blob for eval results and training data
- **LLM Providers**: OpenAI and Google Gemini (extensible)

## Project Structure

```
app/
  ├── evals/           # Main evals UI
  │   ├── page.tsx     # Prompt browser
  │   ├── finetune/    # Fine-tuning UI
  │   └── components/  # Eval UI components
  ├── api/
  │   ├── evals/       # Eval API routes
  │   ├── langfuse/    # Langfuse proxy endpoints
  │   └── inngest/     # Inngest webhook handler
lib/
  ├── inngest/
  │   └── eval/        # Eval execution logic
  ├── ai/              # LLM provider wrappers
  └── observability/   # Langfuse helpers
```

## Contributing

Contributions are welcome! Please open an issue or PR.

## License

MIT
