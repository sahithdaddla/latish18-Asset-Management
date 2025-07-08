CREATE TABLE requests (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(7) NOT NULL CHECK (employee_id ~ '^ATS0(?!000)\d{3}$'),
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN (
        'laptop', 'monitor', 'keyboard', 'mouse', 
        'headphones', 'chair', 'phone', 'tablet'
    )),
    reason TEXT NOT NULL CHECK (
        reason ~ '^[A-Za-z0-9\s.,?@&()[\]\\|\/''"]+$' 
        AND LENGTH(reason) >= 5
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected')
    ),
    request_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status_update_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_active_request UNIQUE (employee_id, asset_type, request_date, is_active)
);

CREATE INDEX idx_requests_employee_id ON requests(employee_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_request_date ON requests(request_date);