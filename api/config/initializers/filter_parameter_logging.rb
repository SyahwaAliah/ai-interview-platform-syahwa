
# Invite tokens grant access to a candidate session; keep them out of the logs.
Rails.application.config.filter_parameters += %i[token invite_token]
