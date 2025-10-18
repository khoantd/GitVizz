# Manual Chat Feature Testing Checklist

## Prerequisites
- [ ] Docker services running (`docker-compose up`)
- [ ] User authenticated with GitHub
- [ ] At least one LLM API key configured

## Test Cases

### 1. Chat Button Visibility
- [ ] Navigate to repository visualization page
- [ ] Floating chat button visible in bottom-right corner
- [ ] Button shows correct icon (MessageCircle or AlertTriangle)
- [ ] "Coming Soon" badge is NOT visible

### 2. Chat Sidebar Opening
- [ ] Click floating chat button
- [ ] Chat sidebar slides in from right
- [ ] Sidebar shows repository name and branch
- [ ] Model selector is visible
- [ ] Input field is ready for typing

### 3. API Key Validation
- [ ] Without API keys: Shows warning message
- [ ] With system keys: Chat works normally
- [ ] With user keys: Can select and use own keys
- [ ] API key modal opens when clicking key icon

### 4. Message Sending
- [ ] Type message in input field
- [ ] Press Enter or click Send button
- [ ] Message appears in chat history
- [ ] Loading indicator shows while processing
- [ ] Response streams in token-by-token

### 5. Context Modes
- [ ] Switch to "Full Context" mode
- [ ] Send message, verify full repo context used
- [ ] Switch to "Smart Context" mode
- [ ] Send message, verify selective context
- [ ] Switch to "Agentic" mode
- [ ] Send message, verify tool usage

### 6. Chat History
- [ ] Click history icon
- [ ] Previous conversations load
- [ ] Can select and load old conversation
- [ ] Messages persist across sessions

### 7. Model Selection
- [ ] Open model selector dropdown
- [ ] Multiple models available (GPT, Claude, Gemini, Groq)
- [ ] Can switch between models
- [ ] Model info shows (tokens, cost)

### 8. Streaming Responses
- [ ] Send complex query
- [ ] Response streams in real-time
- [ ] No lag or freezing
- [ ] Complete response received
- [ ] Markdown formatting works

### 9. Error Handling
- [ ] Send message without API key → Shows error
- [ ] Send message with invalid repo → Shows error
- [ ] Network error → Shows retry option
- [ ] Rate limit exceeded → Shows appropriate message

### 10. Phoenix Observability
- [ ] Open http://localhost:6006
- [ ] Send chat message
- [ ] Trace appears in Phoenix UI
- [ ] Can view LLM call details
- [ ] Token usage tracked

## Performance Tests
- [ ] Chat opens in < 500ms
- [ ] First response starts in < 2s
- [ ] Streaming is smooth (no stuttering)
- [ ] No memory leaks after multiple messages
- [ ] Sidebar resize works smoothly

## Mobile Responsiveness
- [ ] Chat button visible on mobile
- [ ] Sidebar takes full width on mobile
- [ ] Input field accessible with keyboard
- [ ] Messages readable on small screens

## Pass Criteria
- All checkboxes marked
- No console errors
- Smooth user experience
- Phoenix traces visible
