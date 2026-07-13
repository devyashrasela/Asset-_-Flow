const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'AssetFlow API',
    version: '1.0.0',
    description: 'Enterprise Asset & Resource Management System API documentation'
  },
  servers: [
    {
      url: '/api',
      description: 'API base path'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token. Example: "Bearer eyJhbGciOi..."'
      },
      orgIdHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Organization-ID',
        description: 'Enter the active workspace organization ID. Example: "1"'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new global user',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' }
                },
                required: ['name', 'email', 'password']
              }
            }
          }
        },
        responses: {
          201: { description: 'User registered successfully' },
          400: { description: 'Invalid input or user already exists' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user and issue JWT token',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                },
                required: ['email', 'password']
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid email or password' }
        }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Retrieve logged-in user details',
        tags: ['Authentication'],
        responses: {
          200: { description: 'Profile retrieved successfully' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/organizations': {
      post: {
        summary: 'Create a new workspace organization',
        tags: ['Organizations'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' }
                },
                required: ['name', 'slug']
              }
            }
          }
        },
        responses: {
          201: { description: 'Organization created successfully' },
          400: { description: 'Invalid slug or slug already exists' }
        }
      },
      get: {
        summary: 'List all organizations the logged-in user belongs to',
        tags: ['Organizations'],
        responses: {
          200: { description: 'Organizations listed successfully' }
        }
      }
    },
    '/organizations/{id}/invite': {
      post: {
        summary: 'Invite a user to a workspace',
        tags: ['Organizations'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' }
                },
                required: ['email']
              }
            }
          }
        },
        responses: {
          201: { description: 'User invited successfully' },
          400: { description: 'User is already a member' },
          403: { description: 'Forbidden (requires Admin role)' }
        }
      }
    },
    '/organizations/{id}/members': {
      get: {
        summary: 'Retrieve workspace employee directory',
        tags: ['Organizations'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Members listed successfully' },
          403: { description: 'Forbidden (requires Admin role)' }
        }
      }
    },
    '/organizations/{id}/members/{userId}': {
      put: {
        summary: 'Update member role/status/department',
        tags: ['Organizations'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['Employee', 'Department Head', 'Asset Manager', 'Admin'] },
                  status: { type: 'string', enum: ['Active', 'Inactive'] },
                  department_id: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Member updated successfully' },
          403: { description: 'Forbidden' }
        }
      }
    },
    '/departments': {
      get: {
        summary: 'List organization departments',
        tags: ['Departments'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Departments listed successfully' }
        }
      },
      post: {
        summary: 'Create a new department',
        tags: ['Departments'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  parent_id: { type: 'integer' },
                  head_user_id: { type: 'integer' }
                },
                required: ['name']
              }
            }
          }
        },
        responses: {
          201: { description: 'Department created' },
          403: { description: 'Forbidden (requires Admin role)' }
        }
      }
    },
    '/departments/{id}': {
      put: {
        summary: 'Update department details',
        tags: ['Departments'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  parent_id: { type: 'integer' },
                  head_user_id: { type: 'integer' },
                  status: { type: 'string', enum: ['Active', 'Inactive'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Department updated' }
        }
      }
    },
    '/categories': {
      get: {
        summary: 'List categories',
        tags: ['Categories'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Categories listed' }
        }
      },
      post: {
        summary: 'Create asset category',
        tags: ['Categories'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  custom_fields: { type: 'object' }
                },
                required: ['name']
              }
            }
          }
        },
        responses: {
          201: { description: 'Category created' }
        }
      }
    },
    '/assets': {
      get: {
        summary: 'List organization assets',
        tags: ['Assets'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' } },
          { name: 'is_shared_resource', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Assets retrieved' }
        }
      },
      post: {
        summary: 'Register new asset',
        tags: ['Assets'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category_id: { type: 'integer' },
                  is_shared_resource: { type: 'boolean' },
                  serial_number: { type: 'string' },
                  acquisition_date: { type: 'string', format: 'date' },
                  acquisition_cost: { type: 'number' },
                  condition: { type: 'string' },
                  location: { type: 'string' },
                  photo_url: { type: 'string' },
                  custom_values: { type: 'object' }
                },
                required: ['name']
              }
            }
          }
        },
        responses: {
          201: { description: 'Asset registered' }
        }
      }
    },
    '/assets/{tag}': {
      get: {
        summary: 'View specific asset details with history',
        tags: ['Assets'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'tag', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Asset details retrieved' }
        }
      },
      put: {
        summary: 'Update asset details',
        tags: ['Assets'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'tag', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category_id: { type: 'integer' },
                  is_shared_resource: { type: 'boolean' },
                  status: { type: 'string' },
                  serial_number: { type: 'string' },
                  condition: { type: 'string' },
                  location: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Asset updated' }
        }
      }
    },
    '/allocations': {
      get: {
        summary: 'List allocations (role-scoped)',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Active', 'Returned'] } },
          { name: 'from_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to_date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          200: { description: 'Allocations retrieved with is_overdue and is_due_soon flags' }
        }
      },
      post: {
        summary: 'Allocate assets (supports multiple) with FOR UPDATE locking',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  asset_tags: { type: 'array', items: { type: 'string' }, description: 'Array of asset tags to allocate' },
                  asset_tag: { type: 'string', description: 'Single asset tag (legacy compat)' },
                  assigned_to_user_id: { type: 'integer' },
                  expected_return_date: { type: 'string', format: 'date' },
                  notes: { type: 'string' }
                },
                required: ['assigned_to_user_id']
              }
            }
          }
        },
        responses: {
          201: { description: 'Asset(s) allocated' },
          409: { description: 'Conflict — assets not available (includes conflict details + transfer_request_eligible flag)' }
        }
      }
    },
    '/allocations/my': {
      get: {
        summary: 'List current user\'s own allocations',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'User allocations retrieved' }
        }
      }
    },
    '/allocations/overdue': {
      get: {
        summary: 'List all overdue allocations',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Overdue allocations retrieved' }
        }
      }
    },
    '/allocations/asset/{tag}/history': {
      get: {
        summary: 'Allocation history for a specific asset',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'tag', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Asset allocation history retrieved' }
        }
      }
    },
    '/allocations/{id}': {
      get: {
        summary: 'Get allocation detail with timeline',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Allocation detail with activity timeline' }
        }
      }
    },
    '/allocations/{id}/return': {
      patch: {
        summary: 'Process return with condition check-in',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  return_date: { type: 'string', format: 'date' },
                  condition: { type: 'string', enum: ['Good', 'Minor Wear', 'Damaged'] },
                  checkin_notes: { type: 'string' },
                  trigger_maintenance: { type: 'boolean', description: 'If true + Damaged, auto-creates maintenance request' }
                },
                required: ['condition']
              }
            }
          }
        },
        responses: {
          200: { description: 'Asset returned successfully' }
        }
      }
    },
    '/allocations/transfers': {
      get: {
        summary: 'List transfer requests (role-scoped)',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Transfers listed' }
        }
      },
      post: {
        summary: 'Request an asset transfer',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  asset_tag: { type: 'string' },
                  requested_new_holder_id: { type: 'integer' },
                  reason: { type: 'string' },
                  urgency: { type: 'string', enum: ['Normal', 'Urgent'] }
                },
                required: ['asset_tag', 'requested_new_holder_id', 'reason']
              }
            }
          }
        },
        responses: {
          201: { description: 'Transfer request submitted' }
        }
      }
    },
    '/allocations/transfers/{id}/approve': {
      patch: {
        summary: 'Approve transfer request (re-allocates asset)',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Transfer approved and asset re-allocated' }
        }
      }
    },
    '/allocations/transfers/{id}/reject': {
      patch: {
        summary: 'Reject transfer request',
        tags: ['Allocations & Transfers'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string', description: 'Optional rejection reason' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Transfer request rejected' }
        }
      }
    },
    '/bookings': {
      get: {
        summary: 'List bookings for shared resources',
        tags: ['Scheduler / Bookings'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'asset_tag', in: 'query', schema: { type: 'string' } },
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          200: { description: 'Bookings retrieved' }
        }
      },
      post: {
        summary: 'Book a shared resource slot',
        tags: ['Scheduler / Bookings'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  asset_tag: { type: 'string' },
                  start_time: { type: 'string', format: 'date-time' },
                  end_time: { type: 'string', format: 'date-time' }
                },
                required: ['asset_tag', 'start_time', 'end_time']
              }
            }
          }
        },
        responses: {
          201: { description: 'Resource booked successfully' },
          409: { description: 'Conflict: overlapping bookings found' }
        }
      }
    },
    '/bookings/{id}/cancel': {
      put: {
        summary: 'Cancel active booking reservation',
        tags: ['Scheduler / Bookings'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Booking cancelled' }
        }
      }
    },
    '/maintenance': {
      get: {
        summary: 'List maintenance requests (Kanban board)',
        tags: ['Maintenance'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Requests listed' }
        }
      },
      post: {
        summary: 'File a maintenance issue',
        tags: ['Maintenance'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  asset_tag: { type: 'string' },
                  issue_description: { type: 'string' },
                  priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
                  photo_url: { type: 'string' }
                },
                required: ['asset_tag', 'issue_description']
              }
            }
          }
        },
        responses: {
          201: { description: 'Request created' }
        }
      }
    },
    '/maintenance/{id}/status': {
      put: {
        summary: 'Update maintenance request status (swimlane change)',
        tags: ['Maintenance'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['Pending', 'Approved', 'Rejected', 'In Progress', 'Resolved'] }
                },
                required: ['status']
              }
            }
          }
        },
        responses: {
          200: { description: 'Status updated and asset state automatically adjusted' }
        }
      }
    },
    '/audits': {
      get: {
        summary: 'List audit cycles',
        tags: ['Inventory Audits'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Cycles retrieved' }
        }
      },
      post: {
        summary: 'Create audit cycle',
        tags: ['Inventory Audits'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  target_department_id: { type: 'integer' },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' }
                },
                required: ['name', 'target_department_id', 'start_date', 'end_date']
              }
            }
          }
        },
        responses: {
          201: { description: 'Audit cycle scheduled' }
        }
      }
    },
    '/audits/{id}': {
      get: {
        summary: 'Get details of an audit cycle with items',
        tags: ['Inventory Audits'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Details retrieved' }
        }
      }
    },
    '/audits/{id}/start': {
      post: {
        summary: 'Activate audit cycle (auto-populates audit items list)',
        tags: ['Inventory Audits'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Cycle started and verification list generated' }
        }
      }
    },
    '/audits/{id}/items/{itemId}': {
      put: {
        summary: 'Auditor updates verification mark',
        tags: ['Inventory Audits'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  verification_status: { type: 'string', enum: ['Pending', 'Verified', 'Missing', 'Damaged'] },
                  notes: { type: 'string' }
                },
                required: ['verification_status']
              }
            }
          }
        },
        responses: {
          200: { description: 'Verification item updated' }
        }
      }
    },
    '/audits/{id}/complete': {
      post: {
        summary: 'Close audit cycle (locks reports and resolves asset status changes)',
        tags: ['Inventory Audits'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Audit cycle completed and asset statuses updated' }
        }
      }
    },
    '/notifications': {
      get: {
        summary: 'Get notifications feed',
        tags: ['Notifications & Activity Logs'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Feed retrieved' }
        }
      }
    },
    '/notifications/{id}/read': {
      put: {
        summary: 'Mark notification as read',
        tags: ['Notifications & Activity Logs'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Marked read successfully' }
        }
      }
    },
    '/logs': {
      get: {
        summary: 'Retrieve system activity logs',
        tags: ['Notifications & Activity Logs'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'Logs retrieved successfully' }
        }
      }
    },
    '/dashboard': {
      get: {
        summary: 'Retrieve organization dashboard KPI metrics',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: {
          200: { description: 'KPI data aggregated' }
        }
      }
    },
    '/reports/summary': {
      get: {
        summary: 'KPI summary strip — Total Assets, Utilization Rate, Active Maintenance, Overdue Allocations',
        tags: ['Reports & Analytics'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: { 200: { description: 'KPI summary object' } }
      }
    },
    '/reports/utilization': {
      get: {
        summary: 'Asset utilization — most-used, idle assets, monthly trend',
        tags: ['Reports & Analytics'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start date (default: 90 days ago)' },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'End date (default: today)' }
        ],
        responses: { 200: { description: 'Utilization report with most_used, idle_assets, utilization_trend' } }
      }
    },
    '/reports/maintenance': {
      get: {
        summary: 'Maintenance analytics — by asset, category, priority, status',
        tags: ['Reports & Analytics'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: { description: 'Maintenance report with by_asset, by_category, priority_distribution, status_breakdown' } }
      }
    },
    '/reports/lifecycle': {
      get: {
        summary: 'Lifecycle — due for maintenance, nearing retirement, status distribution',
        tags: ['Reports & Analytics'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        responses: { 200: { description: 'Lifecycle report with due_for_maintenance, nearing_retirement, status_distribution' } }
      }
    },
    '/reports/departments': {
      get: {
        summary: 'Department allocation summary + headcount ratio',
        tags: ['Reports & Analytics'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: { description: 'Department report with allocation_summary, headcount_ratio' } }
      }
    },
    '/reports/bookings/heatmap': {
      get: {
        summary: 'Booking heatmap — peak usage windows, most-booked resources, cancellation rate',
        tags: ['Reports & Analytics'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: { description: 'Heatmap, most_booked, cancellation_rate' } }
      }
    },
    '/reports/export': {
      get: {
        summary: 'Export report as CSV',
        tags: ['Reports & Analytics'],
        security: [{ bearerAuth: [], orgIdHeader: [] }],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['utilization', 'maintenance', 'combined'] }, description: 'Report type (default: combined)' },
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: { description: 'CSV file download', content: { 'text/csv': {} } } }
      }
    }
  }
};

export default swaggerDocument;
