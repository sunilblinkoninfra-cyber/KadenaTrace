# Contributing to KadenaTrace

Thank you for your interest in contributing to KadenaTrace! This document provides guidelines for contributing.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code:
- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect privacy and security

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report:
- Check if the bug is already reported in [Issues](../../issues)
- Try the latest version to see if it's already fixed

When reporting bugs, include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node version, etc.)
- Screenshots if applicable

### Suggesting Features

Feature requests are welcome! Please:
- Check if the feature is already requested
- Explain why this feature would be useful
- Provide use cases and examples

### Pull Requests

1. Fork the repository
2. Create a new branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

#### PR Guidelines

- Keep changes focused and atomic
- Update documentation if needed
- Add tests for new features
- Ensure all tests pass
- Follow existing code style

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/KadenaTrace.git
cd KadenaTrace

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

## Project Structure

```
apps/
  web/        # Next.js dashboard
  api/        # Fastify API
  worker/     # BullMQ worker
packages/
  shared/     # Shared domain logic
  pact/       # Pact contracts
```

## Coding Standards

- **TypeScript**: Use strict typing
- **Testing**: Write tests for new features
- **Linting**: Follow existing code patterns
- **Documentation**: Update README/CLAUDE.md if needed

## Commit Messages

Use clear, descriptive commit messages:
- `feat: add new trace visualization`
- `fix: resolve API rate limiting issue`
- `docs: update setup instructions`
- `test: add unit tests for heuristics`

## Questions?

- Open a [Discussion](../../discussions) for questions
- Check existing documentation first

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
