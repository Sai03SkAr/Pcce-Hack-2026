// Kept apart from help.ts so the client widget does not bundle the whole guide.
export const HELP_SUGGESTIONS: Record<string, string[]> = {
  '/': ['What does the morning brief show?', 'Who can see profit?', 'How do I fix an issue?'],
  '/bill': ['How do I bill by voice?', 'Customer is over the credit limit', 'How do I cancel a wrong bill?'],
  '/books': ['How do I record a loan?', 'Bank reconciliation kaise kare?', 'How do I record rent?', 'Cash bank mein jama kaise karu?', 'What is a contra voucher?', 'How do I send books to my CA?'],
  '/inventory': ['How do I add a new item?', 'How do I move stock between branches?', 'Stock aaya, kaise likhu?', 'What do the colours mean?'],
  '/customers': ['Purana udhaar kaise daalu?', 'How do I send a customer their khata?', 'How do I add a new customer?', 'How do I send a payment reminder?', 'Payment kaise record karu?'],
  '/closing': ['How do I close the day?', 'Cash kam nikla toh kya karu?'],
  default: ['How do I make a bill?', 'How do I record an expense?', 'GST return kab bharna hai?', 'How do I get my CA to sign the books?'],
}
