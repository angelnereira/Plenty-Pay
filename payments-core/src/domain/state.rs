#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentIntentStatus { Created, RequiresAction, Processing, Succeeded, Failed, Cancelled }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentStatus { Pending, Authorized, Captured, Failed, Refunded, PartiallyRefunded }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentAttemptStatus { Pending, Succeeded, Failed }
