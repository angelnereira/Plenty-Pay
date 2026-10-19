pub trait RailAdapter {
    fn name(&self) -> &'static str;
    fn sandbox(&self) -> bool;
}

pub struct SandboxRail {
    pub rail_name: &'static str,
}

impl RailAdapter for SandboxRail {
    fn name(&self) -> &'static str { self.rail_name }
    fn sandbox(&self) -> bool { true }
}
