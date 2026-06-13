"""initial_schema

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. companies
    op.create_table(
        'companies',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('invite_code', sa.String(10), unique=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_companies_invite_code', 'companies', ['invite_code'])

    # 2. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('username', sa.String(50), unique=True, nullable=False),
        sa.Column('email', sa.String(100), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100)),
        sa.Column('role', sa.String(20), nullable=False, server_default='user'),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true()),
        sa.Column('company_id', sa.String(50)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )
    op.create_index('idx_users_username', 'users', ['username'])
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_company_id', 'users', ['company_id'])

    # 3. resumes
    op.create_table(
        'resumes',
        sa.Column('resume_id', sa.String(50), primary_key=True),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('resume_text', sa.Text(), nullable=False),
        sa.Column('anonymized_resume_text', sa.Text()),
        sa.Column('user_id', sa.String(50), nullable=False),
        sa.Column('job_id', sa.String(50)),
        sa.Column('embedding_status', sa.String(20), server_default='pending'),
        sa.Column('embedding_error', sa.Text()),
        sa.Column('is_screened', sa.Boolean(), server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )

    # 4. jobs
    op.create_table(
        'jobs',
        sa.Column('job_id', sa.String(50), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('requirements', sa.Text()),
        sa.Column('experience_years', sa.Integer()),
        sa.Column('education', sa.String(50)),
        sa.Column('certifications', sa.Text()),
        sa.Column('salary_range', sa.String(100)),
        sa.Column('location', sa.String(100)),
        sa.Column('user_id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )

    # 5. screening_results
    op.create_table(
        'screening_results',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('result_id', sa.String(50), unique=True, nullable=False),
        sa.Column('job_id', sa.String(50), nullable=False),
        sa.Column('resume_id', sa.String(50), nullable=False),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('screening_type', sa.String(20), nullable=False, server_default='job'),
        sa.Column('rerank_score', sa.Float(), nullable=False),
        sa.Column('raw_score', sa.Float(), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('llm_evaluation', sa.Text(), nullable=False),
        sa.Column('matching_score', sa.Float(), server_default=sa.text('0.0')),
        sa.Column('deleted', sa.Boolean(), server_default=sa.false()),
        sa.Column('user_id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 6. contacts
    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 7. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('operator_id', sa.String(50), nullable=False),
        sa.Column('operator_name', sa.String(50), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=False),
        sa.Column('target_id', sa.String(50), nullable=False),
        sa.Column('detail', sa.Text()),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_audit_logs_operator_id', 'audit_logs', ['operator_id'])
    op.create_index('idx_audit_logs_created_at', 'audit_logs', ['created_at'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('contacts')
    op.drop_table('screening_results')
    op.drop_table('jobs')
    op.drop_table('resumes')
    op.drop_table('users')
    op.drop_table('companies')
