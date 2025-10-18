import { test, expect } from '@playwright/test';

test.describe('Chat Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to repository page
    await page.goto('http://localhost:3000');
  });

  test('should display chat button', async ({ page }) => {
    // Check if floating chat button exists
    const chatButton = page.locator('[data-testid="floating-chat-button"]');
    await expect(chatButton).toBeVisible();
  });

  test('should open chat sidebar on button click', async ({ page }) => {
    // Click chat button
    await page.click('[data-testid="floating-chat-button"]');
    
    // Verify sidebar opens
    const chatSidebar = page.locator('[data-testid="chat-sidebar"]');
    await expect(chatSidebar).toBeVisible();
  });

  test('should require authentication', async ({ page }) => {
    // Without auth, should show sign-in prompt
    await page.click('[data-testid="floating-chat-button"]');
    
    const authPrompt = page.locator('text=/sign in|authenticate/i');
    await expect(authPrompt).toBeVisible();
  });

  test('should display model selector', async ({ page, context }) => {
    // Mock authenticated session
    await context.addCookies([{
      name: 'next-auth.session-token',
      value: 'mock-session',
      domain: 'localhost',
      path: '/'
    }]);

    await page.click('[data-testid="floating-chat-button"]');
    
    const modelSelector = page.locator('[data-testid="model-selector"]');
    await expect(modelSelector).toBeVisible();
  });

  test('should send message and receive response', async ({ page, context }) => {
    // Mock authenticated session with API keys
    await context.addCookies([{
      name: 'next-auth.session-token',
      value: 'mock-session',
      domain: 'localhost',
      path: '/'
    }]);

    await page.click('[data-testid="floating-chat-button"]');
    
    // Type message
    await page.fill('[data-testid="chat-input"]', 'What is this repository about?');
    
    // Send message
    await page.click('[data-testid="send-button"]');
    
    // Wait for response
    await page.waitForSelector('[data-testid="chat-message-assistant"]', {
      timeout: 30000
    });
    
    const response = page.locator('[data-testid="chat-message-assistant"]').first();
    await expect(response).toBeVisible();
  });

  test('should display context mode selector', async ({ page, context }) => {
    await context.addCookies([{
      name: 'next-auth.session-token',
      value: 'mock-session',
      domain: 'localhost',
      path: '/'
    }]);

    await page.click('[data-testid="floating-chat-button"]');
    await page.click('[data-testid="chat-settings"]');
    
    // Verify context modes available
    await expect(page.locator('text=/full|smart|agentic/i')).toBeVisible();
  });
});
